// localEmbeddings.js
import { pipeline } from "@xenova/transformers";

let extractor;

export class LocalEmbeddings {
  async init() {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }

  async embedDocuments(texts) {
    return Promise.all(texts.map(t => this.embedQuery(t)));
  }

  async embedQuery(text) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}