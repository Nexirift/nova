import { env } from "@/env";
import { execSync } from "child_process";
import { existsSync } from "fs";

const gitCommand = "git rev-parse HEAD";

export default function getGitCommitHash() {
  if (existsSync(".git") === false) {
    return "git commit unavailable";
  }

  return execSync(gitCommand).toString().trim().substring(0, 7);
}

export const isTestMode = env.NODE_ENV === "test";
