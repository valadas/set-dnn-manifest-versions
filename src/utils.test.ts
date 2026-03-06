import { describe, it, expect } from 'vitest';
import {
    getVersion,
    getSingleDigitsVersion,
    formatVersionForSolutionInfo,
    replaceManifestVersions,
    replaceSolutionInfoVersions,
    replaceIssueTemplateVersion,
    MANIFEST_READ_REGEX,
} from './utils';

// ---------------------------------------------------------------------------
// getVersion
// ---------------------------------------------------------------------------
describe('getVersion', () => {
    it('parses a standard version string', () => {
        expect(getVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('strips leading zeros from each part (DNN style)', () => {
        expect(getVersion('09.06.02')).toEqual({ major: 9, minor: 6, patch: 2 });
    });

    it('handles zero patch version', () => {
        expect(getVersion('09.06.00')).toEqual({ major: 9, minor: 6, patch: 0 });
    });

    it('handles major version 0', () => {
        expect(getVersion('00.01.00')).toEqual({ major: 0, minor: 1, patch: 0 });
    });
});

// ---------------------------------------------------------------------------
// getSingleDigitsVersion
// ---------------------------------------------------------------------------
describe('getSingleDigitsVersion', () => {
    it('converts DNN-style version to semver string', () => {
        expect(getSingleDigitsVersion('09.06.02')).toBe('9.6.2');
    });

    it('strips leading zeros', () => {
        expect(getSingleDigitsVersion('09.06.00')).toBe('9.6.0');
    });

    it('leaves single-digit versions unchanged', () => {
        expect(getSingleDigitsVersion('1.2.3')).toBe('1.2.3');
    });
});

// ---------------------------------------------------------------------------
// formatVersionForSolutionInfo
// ---------------------------------------------------------------------------
describe('formatVersionForSolutionInfo', () => {
    it('appends .0 to the version', () => {
        expect(formatVersionForSolutionInfo({ major: 9, minor: 6, patch: 2 })).toBe('9.6.2.0');
    });

    it('handles zero patch', () => {
        expect(formatVersionForSolutionInfo({ major: 9, minor: 6, patch: 0 })).toBe('9.6.0.0');
    });

    it('handles all-zero version', () => {
        expect(formatVersionForSolutionInfo({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0.0');
    });
});

// ---------------------------------------------------------------------------
// MANIFEST_READ_REGEX (matching)
// ---------------------------------------------------------------------------
describe('MANIFEST_READ_REGEX', () => {
    it('matches a package element and captures name and version', () => {
        const input = '<package name="MyModule" type="Module" version="09.06.00">';
        // Reset lastIndex since the regex is stateful (flag g)
        MANIFEST_READ_REGEX.lastIndex = 0;
        const match = MANIFEST_READ_REGEX.exec(input);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('MyModule');
        expect(match![2]).toBe('09.06.00');
    });

    it('matches a package element with extra attributes', () => {
        const input = '<package name="AnotherMod" type="Skin" version="02.01.00" folderName="Skins/MyTheme">';
        MANIFEST_READ_REGEX.lastIndex = 0;
        const match = MANIFEST_READ_REGEX.exec(input);
        expect(match).not.toBeNull();
        expect(match![1]).toBe('AnotherMod');
        expect(match![2]).toBe('02.01.00');
    });

    it('does not match a line without a version attribute', () => {
        const input = '<package name="MyModule" type="Module">';
        MANIFEST_READ_REGEX.lastIndex = 0;
        expect(MANIFEST_READ_REGEX.exec(input)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// replaceManifestVersions
// ---------------------------------------------------------------------------
describe('replaceManifestVersions', () => {
    it('replaces the version in a single package element', () => {
        const content = '<package name="MyModule" type="Module" version="09.06.00">';
        const result = replaceManifestVersions(content, '09.07.00');
        expect(result).toBe('<package name="MyModule" type="Module" version="09.07.00">');
    });

    it('replaces versions in multiple package elements', () => {
        const content = [
            '<package name="ModuleA" type="Module" version="01.00.00">',
            '<package name="ModuleB" type="Skin"   version="02.00.00">',
        ].join('\n');
        const result = replaceManifestVersions(content, '03.00.00');
        expect(result).toContain('version="03.00.00"');
        expect(result).not.toContain('version="01.00.00"');
        expect(result).not.toContain('version="02.00.00"');
    });

    it('preserves content surrounding the version attribute', () => {
        const content = '<package name="MyModule" type="Module" version="09.06.00" description="test">';
        const result = replaceManifestVersions(content, '10.00.00');
        expect(result).toContain('name="MyModule"');
        expect(result).toContain('version="10.00.00"');
        expect(result).toContain('description="test"');
    });
});

// ---------------------------------------------------------------------------
// replaceSolutionInfoVersions
// ---------------------------------------------------------------------------
describe('replaceSolutionInfoVersions', () => {
    const sampleSolutionInfo = `
using System.Reflection;
[assembly: AssemblyVersion("9.6.0.0")]
[assembly: AssemblyFileVersion("9.6.0.0")]
[assembly: AssemblyInformationalVersion("9.6.0.0 Custom build")]
`.trim();

    it('updates AssemblyVersion', () => {
        const result = replaceSolutionInfoVersions(sampleSolutionInfo, { major: 9, minor: 7, patch: 0 });
        expect(result).toContain('[assembly: AssemblyVersion("9.7.0.0")]');
    });

    it('updates AssemblyFileVersion', () => {
        const result = replaceSolutionInfoVersions(sampleSolutionInfo, { major: 9, minor: 7, patch: 0 });
        expect(result).toContain('[assembly: AssemblyFileVersion("9.7.0.0")]');
    });

    it('updates AssemblyInformationalVersion with Custom build suffix', () => {
        const result = replaceSolutionInfoVersions(sampleSolutionInfo, { major: 9, minor: 7, patch: 0 });
        expect(result).toContain('[assembly: AssemblyInformationalVersion("9.7.0.0 Custom build")]');
    });

    it('does not touch unrelated lines', () => {
        const result = replaceSolutionInfoVersions(sampleSolutionInfo, { major: 9, minor: 7, patch: 0 });
        expect(result).toContain('using System.Reflection;');
    });
});

// ---------------------------------------------------------------------------
// replaceIssueTemplateVersion
// ---------------------------------------------------------------------------
describe('replaceIssueTemplateVersion', () => {
    const sampleTemplate = `
* [ ] I am using an alpha build
* [ ] I have searched existing issues
`.trim();

    it('injects a release candidate line between alpha and next checkbox', () => {
        const result = replaceIssueTemplateVersion(sampleTemplate, '09.07.00');
        expect(result).toContain('* [ ] 09.07.00 release candidate');
    });

    it('preserves the alpha build line', () => {
        const result = replaceIssueTemplateVersion(sampleTemplate, '09.07.00');
        expect(result).toContain('alpha build');
    });

    it('preserves the next checkbox line', () => {
        const result = replaceIssueTemplateVersion(sampleTemplate, '09.07.00');
        expect(result).toContain('I have searched existing issues');
    });

    it('places the RC line between alpha and the next checkbox', () => {
        const result = replaceIssueTemplateVersion(sampleTemplate, '09.07.00');
        const alphaIdx = result.indexOf('alpha build');
        const rcIdx = result.indexOf('release candidate');
        const nextIdx = result.indexOf('I have searched');
        expect(alphaIdx).toBeLessThan(rcIdx);
        expect(rcIdx).toBeLessThan(nextIdx);
    });
});
