import "dotenv/config";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Chroma } from "@langchain/community/vectorstores/chroma";

async function query() {
  const vectorStore = await Chroma.fromExistingCollection(
    new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_API_TOKEN,
      model: "sentence-transformers/all-MiniLM-L6-v2",
    }),
    {
      collectionName: "rag-knowledge-base",
      host: "localhost",
      port: 8000,
    }
  );

  const results = await vectorStore.similaritySearch("What is ChromaDB?", 1);
  console.log(results);
}

query();
