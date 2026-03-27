import 'dotenv/config'
import { readFileSync } from "fs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from "path"
import fs from "fs"
import { ChromaClient } from "chromadb"
// async function ingest() {
//     const rawText = readFileSync("./data/knowledge.txt", "utf-8");

//     const pdfPath = path.join(
//       process.cwd(),
//       "./data/pdfs/Shailesh_Personal_Profile_Report.pdf"
//     )
//     const loader = new PDFLoader(pdfPath) 
//     const docs= await loader.load()

//     //split file
//     const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 250, chunkOverlap: 50 });
//      const pageContent = docs?.map((c)=>c.pageContent)
//     // chubks
//     let chunks = await splitter.createDocuments(pageContent);
//     // chunks = chunks.map((content,i )=>({...content, id: i}))
//     console.log("Embedding started")
//     const vectorStore = await Chroma.fromDocuments(
//         chunks,
//         new HuggingFaceInferenceEmbeddings({
//             apiKey: process.env.HF_API_TOKEN,
//             model: "sentence-transformers/all-MiniLM-L6-v2",
//             // Xenova/all-MiniLM-L6-v2
//         }),
//         {
//             collectionName: "rag-profile_info",
//             host: "localhost",
//             port: 8000,
//             ssl: false,
//             collectionMetadata: { "hnsw:space": "cosine" }, // cosine similarity = better for text
//         }
//     );

//     const collections = await vectorStore.client.listCollections();
//     console.log("Embedding Done - Collections:", collections);

// }
// ingest()

// Ingest multiple page pdf....

const pdfFolder = "./data/pdfs"
const collectionName = "Shailesh_Knowledge_Base";

async function loadPdf(folderPath) {
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".pdf"));

    if (files.length < 0) {
        console.log("No file found");
    }

    const allDocs = [];
    for (const file of files) {
        const fullPath = path.join(folderPath, file);

        const loader = new PDFLoader(fullPath, {
            splitPages: true,
            parsedItemSeparator: ""
        })
        const docs = await loader.load()

        allDocs.push(...docs)
    }
    return allDocs
}

// chunk the docs
async function chunkDocs(docs) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 300,
        chunkOverlap: 50
    })

    const chunks = await splitter.splitDocuments(docs);
    const rawChunkData = chunks.map(doc => ({
        ...doc,
        metadata: {
            source: doc.metadata.source || "",
            page: doc.metadata?.loc?.pageNumber || null, // extract useful part
        }
    }));
    return rawChunkData
}

async function storeInChroma(chunks) {
    console.log("Embedding and Storing Started")
    const vectorStore = await Chroma.fromDocuments(
        chunks,
        new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_API_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2"
        }),
        {
            collectionName: collectionName,
            host: "localhost",
            port: 8000,
            ssl: false,
            collectionMetadata: { "hnsw:space": "cosine" }, // cosine similarity = better for text
        }
    )
    return vectorStore
}

async function ingest() {
    const docs = await loadPdf(pdfFolder);
    console.log("Docs loaded")
    const chunks = await chunkDocs(docs);
    console.log("Chunking Completed");

    const vectorData = await storeInChroma(chunks)
    console.log("Stored in Chroma")
}

ingest().catch((err) => console.log(err))