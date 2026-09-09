import { createSessionStore } from "./store/sessionStore.js";
import { ClackAskQuestion } from "./tui/askQuestionPrompt.js";
import { ChatLoop } from "./tui/chatLoop.js";
import { ModelFactory } from "./tui/modelFactory.js";
import { promptProviderSetup } from "./tui/providerSetup.js";

async function main(): Promise<void> {
  const setup = await promptProviderSetup();
  const store = createSessionStore();
  store.setProviderSelection(setup);

  const model = new ModelFactory().create(setup);
  const loop = new ChatLoop({
    store,
    model,
    askQuestion: new ClackAskQuestion(),
  });
  await loop.run();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
