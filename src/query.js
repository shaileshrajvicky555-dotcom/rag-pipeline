import  {buildRagChain}  from "./chain.js";
import fs from "fs"
async function ask(question){
 console.log(`\n🤔 Question: ${question}`);
  console.log("⏳ Thinking...\n");

  const chain = await buildRagChain();
  const answer = await chain.invoke(question);

  console.log(`💡 Answer: ${answer}`);
  console.log("─".repeat(60));
}

await ask("What is the capital of France?")
// let res = await ask("Who founded Anthropic?");
// const res = await ask("What is ChromaDB used for?");
