import { type AIMessage, type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGroq } from "@langchain/groq";
import { StateGraph } from "@langchain/langgraph";
import { MemorySaver, Annotation, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { execSync } from 'node:child_process';

interface Commit {
    hash: string;
    message: string;
    date: Date;
    author: string;
    diff?: string;
}

function parseGitDiffs(commits: Commit[], repoPath: string): Commit[] {
    return commits.map(commit => {
        const diffCommand = `git show ${commit.hash}`;
        const diff = execSync(diffCommand, {
            cwd: repoPath,
            encoding: 'utf-8'
        });
        return {
            ...commit,
            diff
        };
    });
}

export function getGitCommits(fullPath: string, sinceDate?: Date, numCommits?: number, excludePattern?: string): Commit[] {
    const gitCommand = numCommits 
        ? `git log -n ${numCommits} --pretty=format:"%h|%s|%ad|%an" --date=iso`
        : `git log --since="${sinceDate?.toISOString()}" --pretty=format:"%h|%s|%ad|%an" --date=iso`;
    
    const gitLog = execSync(gitCommand, {
        cwd: fullPath,
        encoding: 'utf-8'
    });

    const commits = gitLog.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
            const [hash, message, date, author] = line.split('|');
            return {
                hash,
                message,
                date: new Date(date),
                author
            };
        })
        .filter(commit => {
            if (!excludePattern) { return true; }                    
            return !commit.message.includes(excludePattern);
        });

	return parseGitDiffs(commits, fullPath);
}


export function buildAgent(filepath: string, numDays: number, numCommits?: number, excludePattern?: string) {
  // Define the graph state
  // See here for more info: https://langchain-ai.github.io/langgraphjs/how-tos/define-state/
  const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      // `messagesStateReducer` function defines how `messages` state key should be updated
      // (in this case it appends new messages to the list and overwrites messages with the same ID)
      reducer: messagesStateReducer,
    }),
  });

  const getCommitsTool = tool(async () => {
	try {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - numDays);

	  return JSON.stringify(getGitCommits(filepath, new Date(sinceDate), numCommits, excludePattern));
	} catch (error) {
	  return `Error getting commits: ${error}`;
	}
  }, {
    name: "get_commits",
    description: "Get recent git commits from a repository. This will return a JSON array of commits that include the commit hash, message, date, and author. It will also include the diff",
	schema: z.object({}),
  })

  const tools = [getCommitsTool];
  // @ts-ignore
  const toolNode = new ToolNode(tools);

  const model = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  // We can extract the state typing via `StateAnnotation.State`
  function shouldContinue(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, we stop (reply to the user)
    return "__end__";
  }

  // Define the function that calls the model
  async function callModel(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    const response = await model.invoke(messages);

    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  }

  // Define a new graph
  const workflow = new StateGraph(StateAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
  	.addEdge("tools", "agent");


  // Initialize memory to persist state between graph runs
  const checkpointer = new MemorySaver();

  // Finally, we compile it!
  // This compiles it into a LangChain Runnable.
  // Note that we're (optionally) passing the memory when compiling the graph
  const app = workflow.compile({ checkpointer });

  return app;
}

