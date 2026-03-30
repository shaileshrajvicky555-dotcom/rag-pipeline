import { ChromaClient } from "chromadb";
// import  {buildRagChain}  from "./chain.js";
import { buildStremingRagChain } from "./chain.js"
import fs from "fs"
// async function ask(question){
//  console.log(`\n${"═".repeat(60)}`);
//   console.log(`🤔 Question: ${question}`);
//   console.log("─".repeat(60));

//   const chain = await buildRagChain();
//   const result = await chain.invoke(question);

//   console.log(`💡 Answer: ${result.answer}`);
//   // console.log("result:", JSON.stringify(result, null, 2))
//   if (result.source.length > 0) {
//     console.log("\n📚 Sources:");
//     result.source.forEach((src) => {
//       console.log(`   • ${src.file} — Page ${src.page}`);
//     });
//   }
// }

async function askStremaing(question) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🤔 Question: ${question}`);
  console.log("─".repeat(60));
  console.log("💡 Answer:\n");

  const { retrivalChain, generationChain, extractSources } = await buildStremingRagChain();

  const retrived = await retrivalChain.invoke({ question: question });
  const sources = extractSources(retrived.sourceDocs);

  const stream = await generationChain.stream({
    context: retrived.context,
    question: question
  })
  let fullAnswer = "";
  let usageMetadata = null;

  for await (const chunk of stream) {
    const text = chunk.content ?? "";
    process.stdout.write(text);
    if (chunk?.response_metadata?.usage) {
      usageMetadata = { ...usageMetadata, ...chunk.response_metadata.usage };
    }
    fullAnswer += chunk.content
  }

  //   if (sources.length > 0) {
  //   console.log("📚 Sources:");
  //   sources.forEach((src) => {
  //     console.log(`   • ${src.file} — Page ${src.page}`);
  //   });
  // }
  console.log("\n")
  console.log("─".repeat(60));

  return { answer: fullAnswer, sources, usageMetadata };
}

const res = await askStremaing("Who is Prachish")
