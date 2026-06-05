import artifactRoles from './artifact-roles.json';

export const SITEGRAPH_ARTIFACT_ROLES = artifactRoles as readonly string[];
export type SitegraphArtifactRole = typeof SITEGRAPH_ARTIFACT_ROLES[number];
export const SITEGRAPH_ARTIFACT_ROLE_SET = new Set<string>(SITEGRAPH_ARTIFACT_ROLES);

export const isSitegraphArtifactRole = (value: string): value is SitegraphArtifactRole => {
    return SITEGRAPH_ARTIFACT_ROLE_SET.has(value);
};
