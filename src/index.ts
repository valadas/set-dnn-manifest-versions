import * as core from '@actions/core';
import fg from 'fast-glob';
import { readFileSync, writeFile, createReadStream } from 'fs';
import * as readline from 'readline';
import {
    getVersion,
    getSingleDigitsVersion,
    MANIFEST_READ_REGEX,
    replaceManifestVersions,
    replaceSolutionInfoVersions,
    replaceIssueTemplateVersion,
} from './utils';

async function run() {
    try {
        const version = core.getInput('version');
        let globInclude = core.getInput('glob');
        let globIgnore: string[] = [];
        const skipFile = core.getInput('skipFile');
        const includeSolutionInfo = core.getInput('includeSolutionInfo').toUpperCase() === "TRUE";
        const includeIssueTemplates = core.getInput('includeIssueTemplates').toUpperCase() === "TRUE";
        const includePackageJson = core.getInput('includePackageJson').toUpperCase() === "TRUE";
        const includeDnnReactCommon = core.getInput('includeDnnReactCommon').toUpperCase() === "TRUE";
        console.log("skipFile provided: ", skipFile);

        // Generate the glob if skipFile is provided
        if (skipFile !== null && skipFile.length > 0) {
            globInclude = "**/*.dnn";
            const fileStream = createReadStream(skipFile);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            for await (const line of rl) {
                if (line.trim().length > 0) {
                    globIgnore.push(line.trim());
                    console.log("Adding " + line + " to ignored globs.");
                }
            }
            console.log("Using glob: ", globInclude, "ignoring:", globIgnore);
            core.debug("Using glob: " + globInclude + " ignoring: " + globIgnore.join(', '));
        }

        // Get the files
        const files = await fg(globInclude, { ignore: globIgnore });
        files.forEach(file => {
            // Read the manifest
            core.startGroup(file);
            let manifestContent = readFileSync(file).toString();
            let result;
            while((result = MANIFEST_READ_REGEX.exec(manifestContent)) !== null) {
                // Log what we are doing
                console.log(`Setting ${result[1]} from ${result[2]} to ${version}`);
            }
            // Replace the version
            manifestContent = replaceManifestVersions(manifestContent, version);
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
            const solutionInfos = await fg('./**/SolutionInfo.cs', { followSymbolicLinks: false });
            solutionInfos.forEach((solutionInfo: string) => {
                const versionInfo = getVersion(version);
                let solutionInfoContent = readFileSync(solutionInfo).toString();
                solutionInfoContent = replaceSolutionInfoVersions(solutionInfoContent, versionInfo);
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
            const issueFiles = await fg('./.github/ISSUE_TEMPLATE/bug-report.md');
            let issueContent = readFileSync(issueFiles[0]).toString();
            issueContent = replaceIssueTemplateVersion(issueContent, version);
            writeFile(issueFiles[0], issueContent, err => {
                if (err) {
                    core.setFailed(err.message);
                }
                else {
                    console.log("updated ", issueFiles[0]);
                }
            });
            core.endGroup();
        }

        // Update package.json
        if (includePackageJson) {
            const singleDigitsVersion = getSingleDigitsVersion(version);
            const packageJsonFiles = await fg('./**/package.json');
            packageJsonFiles.forEach((file: string) => {
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

run();

export default run;