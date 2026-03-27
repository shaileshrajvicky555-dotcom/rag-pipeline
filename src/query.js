import  {buildRagChain}  from "./chain.js";
import {buildStremingRagChain} from "./chain.js"
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

async function askStremaing(question){
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🤔 Question: ${question}`);
  console.log("─".repeat(60));
  console.log("💡 Answer:\n");

   const { retrievalChain, generationChain, extractSources } = await buildStremingRagChain();

   const retrived = await retrievalChain.invoke(question);
  //  const sources = extractSources(retrived.sourceDocs);
   console.log("sources:", sources)



}

await askStremaing("Who is Shailesh")
