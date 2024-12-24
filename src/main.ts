import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAgent } from './agent';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const program = new Command();

program
    .name('changelog')
    .description('CLI tool for summarizing recent changes and generating a changelog')
    .argument('<filepath>', 'path to changelog file')
    .option('-s, --num_days <days>', 'number of days to look back')
    .option('-n, --num_commits <number>', 'number of commits to look back') 
    .option('-e, --exclude <pattern>', 'exclude commits whose messages match this pattern')
    .action(async (filepath: string) => {
        const opts = program.opts();
        
        // Validate that at most one of -n or -s is specified
        if (opts.since && opts.num_commits) {
            console.error('Error: Cannot specify both --since and --num_commits');
            process.exit(1);
        }

        // Validate that num_days is a number if specified
        if (opts.num_days && Number.isNaN(Number(opts.num_days))) {
            console.error('Error: --num_days must be a number');
            process.exit(1);
        }

        // Validate that num_commits is a number if specified 
        if (opts.num_commits && Number.isNaN(Number(opts.num_commits))) {
            console.error('Error: --num_commits must be a number');
            process.exit(1);
        }

        // Handle relative paths by joining with current working directory
        const fullPath = path.isAbsolute(filepath) ? filepath : path.join(process.cwd(), filepath);

        // Check if the provided file path exists
        if (!fs.existsSync(fullPath)) {
            console.error(`Error: File not found at path: ${fullPath}`);
            process.exit(1);
        }

        // Check for .git directory in the changelog directory or its parents
        const gitPath = path.join(fullPath, '.git');
        if (!fs.existsSync(gitPath)) {
            console.error('Error: No git repository found in changelog directory or its parents');
            process.exit(1);
        }

        // Get the number of days to look back
        const numDays = opts.num_days ? Number.parseInt(opts.num_days) : 7;
        try {
            const finalState = await buildAgent(filepath, numDays, opts.num_commits, opts.exclude).invoke(
                { messages: [
                    new SystemMessage("You are an expert in generating customer facing changelogs. You are provided the tools to look at the recent commits in a git repository. Please focus on providing context for the changes, and the motivation for the changes."), 
                    new HumanMessage("Please summarize the recent work done. Provide only a bulleted list. Add the author at the end of the list item in the format: - [@author]")] },
                { configurable: { thread_id: "42" } }
              );
              console.log(finalState.messages[finalState.messages.length - 1].content);

        } catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    });

program.parse();
