import "dotenv/config"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from '@langchain/groq';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { RunnablePassthrough, RunnableMap, RunnableLambda } from "@langchain/core/runnables"
import { StringOutputParser } from '@langchain/core/output_parsers';

export async function buildRagChain() {

    const vectorStore = new Chroma(
        new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_API_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2",
        }),
        {
            collectionName: "rag-knowledge-base",
            host: "localhost",
            port: 8000,
            ssl: false,
        }
    )

    const retriever = vectorStore.asRetriever({ k: 3 });

    const llm = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'openai/gpt-oss-20b',
        temperature: 0,
    })

    const prompt = ChatPromptTemplate.fromTemplate(`
You are a helpful assistant. Answer the question using ONLY the context provided below.
If the answer is not in the context, say "I don't have information about that."
Do NOT make up answers.

Context:
{context}

Question: {question}

Answer:`);

    // const formatDocs = (docs) =>
    //     docs.map((doc) => doc.pageContent).join("\n\n---\n\n");
    const formatDocs = (docs) =>
        docs.map((doc) => doc.pageContent).join("\n\n---\n\n");


    const ragChain = RunnableMap.from({
        // context: retriever.pipe(formatDocs),
        context: retriever.pipe(
            new RunnableLambda({
                func: formatDocs,
            })
        ),
        question: new RunnablePassthrough(),
    })
        .pipe(prompt)
        .pipe(llm)
        .pipe(new StringOutputParser())


    return ragChain
}

