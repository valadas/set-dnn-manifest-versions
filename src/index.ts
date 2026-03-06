import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { readFileSync, writeFile, createReadStream } from 'fs';
import * as readline from 'readline';

async function run() {
    try {
        const version = core.getInput('version');
        let globPattern = core.getInput('glob');
        const skipFile = core.getInput('skipFile');
        const includeSolutionInfo = core.getInput('includeSolutionInfo').toUpperCase() === "TRUE";
        const includeIssueTemplates = core.getInput('includeIssueTemplates').toUpperCase() === "TRUE";
        const includePackageJson = core.getInput('includePackageJson').toUpperCase() === "TRUE";
        const includeDnnReactCommon = core.getInput('includeDnnReactCommon').toUpperCase() === "TRUE";
        console.log("skipFile provided: ", skipFile);

        // Generate the glob if skipFile is provided
        if (skipFile !== null && skipFile.length > 0) {
            globPattern = "**/*.dnn";
            const fileStream = createReadStream(skipFile);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            for await (const line of rl) {
                globPattern += "\n!" + line;
                console.log("Adding " + line + " to ignored globs.");
            }
            console.log("Using glob: ", globPattern);
            core.debug("Using glob: " + globPattern);
        }

        // Get the files
        const globber = await glob.create(globPattern);
        const files = await globber.glob();
        files.forEach(file => {
            // Read the manifest
            core.startGroup(file);
            let manifestContent = readFileSync(file).toString();
            const manifestRegex = /<package.*name="(.*?)".*version="(.*)".*/gm;
            let result;
            while((result = manifestRegex.exec(manifestContent)) !== null) {
                // Log what we are doing
                console.log(`Setting ${result[1]} from ${result[2]} to ${version}`);
            }
            // Replace the version
            const replaceRegex = /(<package.*name=".*?".*version=")(.*)(".*)/gm;
            manifestContent = manifestContent.replace(replaceRegex, `$1${version}$3`);
            // Save the file back
            writeFile(file, manifestContent, err => {
                if (err){
                    core.setFailed(err.message);
                }
                else{
                    console.log(`Saved ${file}`);
                    core.endGroup();
                }
            });
        });

        // Handle the solutionInfo.cs file
        if (includeSolutionInfo) {
            const solutionInfoGlob = await glob.create('./**/SolutionInfo.cs', { followSymbolicLinks: false });
            const solutionInfos = await solutionInfoGlob.glob();
            solutionInfos.forEach(solutionInfo => {
                const versionInfo = getVersion(version);
                const formatedVersion = formatVersionForSolutionInfo(versionInfo);
                let solutionInfoContent = readFileSync(solutionInfo).toString();
                solutionInfoContent = solutionInfoContent.replace(
                    /\[assembly: AssemblyVersion\(".*"\)\]/gm, 
                    `[assembly: AssemblyVersion("${formatedVersion}")]`);
                solutionInfoContent = solutionInfoContent.replace(
                    /\[assembly: AssemblyFileVersion\(".*"\)\]/gm, 
                    `[assembly: AssemblyFileVersion("${formatedVersion}")]`);
                solutionInfoContent = solutionInfoContent.replace(
                    /\[assembly: AssemblyInformationalVersion\(".*"\)\]/gm, 
                    `[assembly: AssemblyInformationalVersion("${formatedVersion} Custom build")]`);
                writeFile(solutionInfo, solutionInfoContent, err => {
                    if (err){
                        core.setFailed(err.message);
                    }
                    else{
                        console.log(solutionInfo + ' saved.');
                    }
                });
            });
        }

        // Update the issue templates
        if (includeIssueTemplates) {
            core.startGroup("Updating issue template");
            const issueTemplateGlob = await glob.create('./.github/ISSUE_TEMPLATE/bug-report.md');
            const files = await issueTemplateGlob.glob();
            let issueContent = readFileSync(files[0]).toString();
            issueContent = issueContent.replace(
                /([.\s\S]*?\* \[ \].*alpha build)([.\s\S]*?)(\* \[ \].*)/gm,
                `$1\n* [ ] ${version} release candidate\n$3`
            );
            writeFile(files[0], issueContent, err => {
                if (err) {
                    core.setFailed(err.message);
                }
                else {
                    console.log("updated ", files[0]);
                }
            });
            core.endGroup();
        }

        // Update package.json
        if (includePackageJson) {
            const singleDigitsVersion = getSingleDigitsVersion(version);
            const packageJsonGlob = await glob.create('./**/package.json');
            const files = await packageJsonGlob.glob();
            files.forEach(file => {
                const packageJsonContent = readFileSync(file).toString();
                const packageJson = JSON.parse(packageJsonContent);
                core.startGroup(packageJson['name']);
                if (packageJson.hasOwnProperty('version')) {
                    console.log("from ", packageJson['version']);
                    packageJson['version'] = getSingleDigitsVersion(version);
                    console.log("to ", packageJson['version']);
                }
                if (includeDnnReactCommon && packageJson.hasOwnProperty('devDependencies') && packageJson.devDependencies.hasOwnProperty('@dnnsoftware/dnn-react-common')) {
                    console.log("@dnnsoftware/dnn-react-common from", packageJson['devDependencies']['@dnnsoftware/dnn-react-common']);
                    packageJson['devDependencies']['@dnnsoftware/dnn-react-common'] = singleDigitsVersion;
                    console.log("to ", singleDigitsVersion);
                }
                if (includeDnnReactCommon && packageJson.hasOwnProperty('dependencies') && packageJson.dependencies.hasOwnProperty('@dnnsoftware/dnn-react-common')) {
                    console.log("@dnnsoftware/dnn-react-common from", packageJson['dependencies']['@dnnsoftware/dnn-react-common']);
                    packageJson['dependencies']['@dnnsoftware/dnn-react-common'] = singleDigitsVersion;
                    console.log("to ", singleDigitsVersion)
                }
                const newFileContent = JSON.stringify(packageJson, null, 2);
                writeFile(file, newFileContent, err => {
                    if (err) {
                        core.setFailed(err.message);
                    }
                    else {
                        console.log ("saved");
                    }
                });
                core.endGroup();
            });
        }

    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed(String(error));
        }
    }
}

const getVersion = (versionString: string): Version => {
    const parts = versionString.split('.');
    return {
        major: parseInt(parts[0]),
        minor: parseInt(parts[1]),
        patch: parseInt(parts[2])
    };
}

const getSingleDigitsVersion = (version: string): string => {
    const v = getVersion(version);
    return v.major + "." + v.minor + "." + v.patch;
}

const formatVersionForSolutionInfo = (version: Version): string => {
    return `${version.major}.${version.minor}.${version.patch}.0`;
}

interface Version {
    major: number,
    minor: number,
    patch: number
}

run()

export default run;