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
