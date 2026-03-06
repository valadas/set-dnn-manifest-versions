export interface Version {
    major: number;
    minor: number;
    patch: number;
}

/**
 * Parses a DNN-style version string (e.g. "09.06.02") into a Version object.
 * Leading zeros are stripped by parseInt.
 */
export const getVersion = (versionString: string): Version => {
    const parts = versionString.split('.');
    return {
        major: parseInt(parts[0], 10),
        minor: parseInt(parts[1], 10),
        patch: parseInt(parts[2], 10),
    };
};

/**
 * Converts a DNN-style version string to a single-digit semver string.
 * e.g. "09.06.02" → "9.6.2"
 */
export const getSingleDigitsVersion = (version: string): string => {
    const v = getVersion(version);
    return `${v.major}.${v.minor}.${v.patch}`;
};

/**
 * Formats a Version for use in AssemblyVersion attributes.
 * e.g. { major: 9, minor: 6, patch: 2 } → "9.6.2.0"
 */
export const formatVersionForSolutionInfo = (version: Version): string => {
    return `${version.major}.${version.minor}.${version.patch}.0`;
};

// ---------------------------------------------------------------------------
// Regex patterns (exported so they can be tested and reused)
// ---------------------------------------------------------------------------

/**
 * Matches a DNN manifest <package> element and captures name + current version.
 * Capture groups: $1 = package name, $2 = current version
 */
export const MANIFEST_READ_REGEX = /<package.*name="(.*?)".*version="([^"]+)".*/gm;

/**
 * Replaces the version attribute value in a DNN manifest <package> element.
 * Capture groups: $1 = opening portion up to version=", $2 = version value, $3 = closing portion
 */
export const MANIFEST_REPLACE_REGEX = /(<package.*name=".*?".*version=")([^"]+)(".*)/gm;

/**
 * Matches and replaces [assembly: AssemblyVersion("...")] in SolutionInfo.cs
 */
export const ASSEMBLY_VERSION_REGEX = /\[assembly: AssemblyVersion\(".*"\)\]/gm;

/**
 * Matches and replaces [assembly: AssemblyFileVersion("...")] in SolutionInfo.cs
 */
export const ASSEMBLY_FILE_VERSION_REGEX = /\[assembly: AssemblyFileVersion\(".*"\)\]/gm;

/**
 * Matches and replaces [assembly: AssemblyInformationalVersion("...")] in SolutionInfo.cs
 */
export const ASSEMBLY_INFORMATIONAL_VERSION_REGEX = /\[assembly: AssemblyInformationalVersion\(".*"\)\]/gm;

/**
 * Matches the issue template block between alpha build and the next checkbox,
 * used to inject a new RC version line.
 * Capture groups: $1 = everything up to and including alpha line, $2 = gap, $3 = next checkbox line
 */
export const ISSUE_TEMPLATE_REGEX = /([.\s\S]*?\* \[ \].*alpha build)([.\s\S]*?)(\* \[ \].*)/gm;

// ---------------------------------------------------------------------------
// Replacement helpers
// ---------------------------------------------------------------------------

/** Replaces all package versions in a manifest file's content. */
export const replaceManifestVersions = (content: string, version: string): string =>
    content.replace(MANIFEST_REPLACE_REGEX, `$1${version}$3`);

/** Replaces all AssemblyVersion / AssemblyFileVersion attributes in SolutionInfo content. */
export const replaceSolutionInfoVersions = (content: string, version: Version): string => {
    const formatted = formatVersionForSolutionInfo(version);
    return content
        .replace(ASSEMBLY_VERSION_REGEX, `[assembly: AssemblyVersion("${formatted}")]`)
        .replace(ASSEMBLY_FILE_VERSION_REGEX, `[assembly: AssemblyFileVersion("${formatted}")]`)
        .replace(
            ASSEMBLY_INFORMATIONAL_VERSION_REGEX,
            `[assembly: AssemblyInformationalVersion("${formatted} Custom build")]`,
        );
};

/** Injects a new RC version line into an issue template's content. */
export const replaceIssueTemplateVersion = (content: string, version: string): string =>
    content.replace(ISSUE_TEMPLATE_REGEX, `$1\n* [ ] ${version} release candidate\n$3`);
