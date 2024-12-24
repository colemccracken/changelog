# Changelog Generator

Are your develepors lazy and writing commit messages that look like `fix: docs`? Use this CLI tool powered by LangGraph and Groq to automatically generate changelogs from git commit history.

## Installation

```bash
pnpm install
```

### Install ts-node globally if you don't have it already

```bash
pnpm add -g ts-node
```

## Usage

This will generate a changelog for this repo for the last 30 days!

```bash
ts-node src/main.ts . --num_days 30 --exclude "chore"
```

For instance- when I first created this repo:

```bash
git log

commit ca5f7cbbf503bb80d57cfe51d639a5d6c4dc23ce (HEAD -> main)
Author: Cole McCracken <colemccracken@gmail.com>
Date:   Tue Dec 24 11:59:33 2024 -0500

    initial commit
```

```bash
ts-node src/main.ts . --num_days 30 --exclude chore

* Initial commit of the project, including the creation of the README file, package.json, and other necessary files - [@Cole McCracken]
* Added the getGitCommits function to retrieve recent git commits from a repository - [@Cole McCracken]
* Implemented the buildAgent function to create a LangChain agent for generating changelogs - [@Cole McCracken]
* Created the main.ts file to handle command-line arguments and invoke the buildAgent function - [@Cole McCracken]
```
