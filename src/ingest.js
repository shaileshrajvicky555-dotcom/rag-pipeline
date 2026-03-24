import 'dotenv/config'
import { readFileSync } from "fs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
// import { LocalEmbeddings } from "./localEmbeddings.js";

// const embeddings = new LocalEmbeddings();
// await embeddings.init();

async function ingest() {
    // console.log(process.env.CHROMA_URL, 'chroma url');
    // return;
    //load file
    const rawText = readFileSync("./data/knowledge.txt", "utf-8");

    //split file
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 250, chunkOverlap: 50 });

    // chubks
    const chunks = await splitter.createDocuments([rawText]);

    console.log("Embedding started")
    const vectorStore = await Chroma.fromDocuments(
        chunks,
        new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_API_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2",
            // Xenova/all-MiniLM-L6-v2
        }),
        {
            collectionName: "rag-knowledge-base",
            host: "localhost",
            port: 8000,
            ssl: false,
            collectionMetadata: { "hnsw:space": "cosine" }, // cosine similarity = better for text
        }
    );

    const collections = await vectorStore.client.listCollections();
    console.log("Collections:", collections);

}
ingest()