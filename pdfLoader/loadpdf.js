import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import path from "path"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import fs from 'fs'
import 'dotenv/config'
import vector from '../embeddings.json' with { type: 'json' };

//
const pdfPath = path.join(
  process.cwd(),
  "data/Shailesh_Personal_Profile_Report.pdf"
)

const loader = new PDFLoader(pdfPath)
const document = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 20 })
const docs = await splitter.splitDocuments(document);
const contents = docs.map(doc => doc.pageContent);
const metadatas = docs.map(doc => doc.metadata)

// const embeddings = new HuggingFaceInferenceEmbeddings({
  // apiKey: process.env.HF_API_TOKEN,
  // model: "sentence-transformers/all-MiniLM-L6-v2",
// });

// const vectors = await embeddings.embedDocuments(contents)

// const vectorDB = vectors.map((vector, index) => ({
//   id: index,
//   vector,
//   text: contents[index],
//   metadata: metadatas[index]
// }));

// fs.writeFileSync(
//   "embeddings.json",
//   JSON.stringify(vectorDB, null, 2)
// )

