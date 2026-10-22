import * as core from "@actions/core";
import { fetchDiff, loadRulesFromBase, fetchOpenThreads } from "./github.js";
import {
  parseIgnoredPaths,
  filterDiff,
  extractChangedFilePaths,
} from "./filtering.js";
import { loadPerPathRules } from "./pathRules.js";
import { OpenThread, PathRuleFile } from "./types.js";

export type ReviewPreparationConfig = {
  ignoredPaths?: string;
  rulesFilePath?: string;
  rulesDirectory?: string;
};

export type PreparedDiff = {
  diff: string;
  changedFiles: string[];
  rulesFromFile?: string;
  perPathRules: PathRuleFile[];
  openThreads: OpenThread[];
};

export type ReviewScope = {
  baseSha: string;
  headSha: string;
};

export async function prepareReview(
  octokit: ReturnType<typeof import("@actions/github").getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  scope: ReviewScope,
  config: ReviewPreparationConfig
): Promise<PreparedDiff> {
  // Always the whole PR diff, even on synchronize: before...head after a merge
  // or rebase from the base branch holds the base's commits, not the PR's.
  core.info(`Reviewing full PR diff from ${scope.baseSha} to ${scope.headSha}`);

  const [diff, rulesFromFile, openThreads] = await Promise.all([
    fetchDiff(
      octokit,
      owner,
      repo,
      { number: prNumber },
      scope.baseSha,
      scope.headSha
    ),
    config.rulesFilePath
      ? loadRulesFromBase(
          octokit,
          owner,
          repo,
          config.rulesFilePath,
          scope.baseSha
        )
      : Promise.resolve(undefined),
    fetchOpenThreads(octokit, owner, repo, prNumber),
  ]);

  const filteredDiff = filterDiff(diff, parseIgnoredPaths(config.ignoredPaths));
  const changedFiles = extractChangedFilePaths(filteredDiff);
  const perPathRules = config.rulesDirectory
    ? await loadPerPathRules(
        octokit,
        owner,
        repo,
        config.rulesDirectory,
        scope.baseSha,
        changedFiles
      )
    : [];

  return {
    diff: filteredDiff,
    changedFiles,
    rulesFromFile,
    perPathRules,
    openThreads,
  };
}
