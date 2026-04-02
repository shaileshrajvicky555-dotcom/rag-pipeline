import "dotenv/config"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from '@langchain/groq';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { RunnablePassthrough, RunnableMap, RunnableLambda, RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables"
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createHistoryAwareRetriever } from "@langchain/classic/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";
import { getSessionHistory } from "./memoryStore.js";

// export async function buildRagChain() {

//     const vectorStore = new Chroma(
//         new HuggingFaceInferenceEmbeddings({
//             apiKey: process.env.HF_API_TOKEN,
//             model: "sentence-transformers/all-MiniLM-L6-v2",
//         }),
//         {
//             collectionName: "Shailesh_Knowledge_Base",
//             // collectionName: "rag-profile_info",
//             // collectionName: "rag-knowledge-base",
//             host: "localhost",
//             port: 8000,
//             ssl: false,
//         }
//     )

//     const retriever = vectorStore.asRetriever({ k: 3 });
//     // console.log(retriever)
//     const llm = new ChatGroq({
//         apiKey: process.env.GROQ_API_KEY,
//         model: 'openai/gpt-oss-20b',
//         temperature: 0,
//     })

//     const prompt = ChatPromptTemplate.fromTemplate(`
// You are a helpful assistant. Answer the question using ONLY the context provided below.
// If the answer is not in the context, say "I don't have information about that."
// Do NOT make up answers.

// Context:
// {context}

// Question: {question}

// Answer:`);

//     // const formatDocs = (docs) =>
//     //     docs.map((doc) => doc.pageContent).join("\n\n---\n\n");
//     const formatDocs = (docs) =>
//         docs.map((doc) => doc.pageContent).join("\n\n---\n\n");

//     // const ragChain = RunnableMap.from({
//     //     // context: retriever.pipe(formatDocs),
//     //     context: retriever.pipe(
//     //         new RunnableLambda({
//     //             func: formatDocs,
//     //         })
//     //     ),
//     //     question: new RunnablePassthrough(),
//     // })
//     //     .pipe(prompt)
//     //     .pipe(llm)
//     //     .pipe(new StringOutputParser())
// const ragChainWithSource = RunnableSequence.from([
//     {
//         context: retriever.pipe(formatDocs),
//         question: new RunnablePassthrough(),
//         sourceDocs: retriever
//     },
//     {
//         answer: RunnableSequence.from([
//             (input) => ({ context: input.context, question: input.question }),
//             prompt,
//             llm,
//             new StringOutputParser()
//         ]),
//         source: (input) =>
//             [...new Map(
//                 input.sourceDocs.map((doc) => [
//                     `${doc.metadata.source}-${doc.metadata.loc?.pageNumber}`,
//                     {
//                         file: doc.metadata.source?.split("/").pop(), // just the filename
//                         page: doc.metadata.loc?.pageNumber ?? "N/A",
//                     },
//                 ])
//             ).values()]
//     }
// ])
//     return ragChainWithSource
// }



//Streaming data

// For .invoke() — returns { answer, sources }
// export async function buildRagChain() {
//     const { retriver, llm, prompt, extractSources, formatDocuments } = await getChainParts();
//     const ragChain = RunnableSequence.from([
//         {
//             context: retriver.pipe(formatDocuments),
//             question: new RunnablePassthrough(),
//             source: retriver
//         },
//         {
//             answer: RunnableSequence.from([
//                 (input) => ({ context: input.context, question: input.question }),
//                 prompt,
//                 llm,
//                 new StringOutputParser()
//             ]),
//             source: (input) => extractSources(input.sourceDocs),
//         },
//     ])
//     return ragChain
// }

async function getChainParts() {

    const vectorStore = new Chroma(
        new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_API_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2",
        }),
        {
            collectionName: "Shailesh_Knowledge_Base",
            host: "localhost",
            port: 8000,
            ssl: false,
        }
    )

    const retriver = vectorStore.asRetriever({ k: 3 }) //retriver

    const llm = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        // model: 'openai/gpt-oss-20b',
        temperature: 0,
        streaming: true,
    })

    const prompt = ChatPromptTemplate.fromTemplate(
        `You are a helpfull assisstent. Answer the question using ONLY the context below
         If the answer is not found, "I don't have answer about that in the provided documents."
         Context:
         {context}

        Question: {question}
        Answer:`
    )

    const formatDocuments = (docs) =>
        docs.map((d) => d.pageContent).join("\n\n---\n\n")

    const extractSources = (docs) =>
        [...new Map(
            docs.map((doc) => [
                `${doc.metadata.source}-${doc.metadata.loc?.pageNumber}`,
                {
                    file: doc.metadata.source?.split("/").pop(),
                    page: doc.metadata.loc?.pageNumber ?? "N/A",
                },
            ])
        ).values()];

    return { retriver, llm, prompt, extractSources, formatDocuments }
}

// For .stream() — streams tokens + sources separately
export async function buildStremingRagChain() {
    const { retriver, llm, prompt, formatDocuments, extractSources } = await getChainParts();

    const retrivalChain = RunnablePassthrough.assign({
        sourceDocs: (input) => retriver.invoke(input.question)
    }).assign({
        context: (input) => formatDocuments(input.sourceDocs)
    })
    const generationChain = RunnableSequence.from([
        (input) => ({ context: input.context, question: input.question }),
        prompt,
        llm,
        // new StringOutputParser()
    ])

    return { retrivalChain, generationChain, extractSources }
}

export async function buildConversationalRagChain() {

    const vectorStore = new Chroma(
        new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HF_API_TOKEN,
            model: "sentence-transformers/all-MiniLM-L6-v2",
        }),
        {
            collectionName: "Shailesh_Knowledge_Base",
            host: "localhost",
            port: 8000,
            ssl: false,
        }
    )

    const retriver = vectorStore.asRetriever({ k: 3 })

    const llmForQa = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        streaming: true,
    }).withConfig({ tags: ["qa_llm"] });

    const llmForRephrase = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        streaming: true,
    })

    const rephrasePrompt = ChatPromptTemplate.fromMessages([
        [
            "system",
            `Given a chat history and and a follow up question, rephrase the follow up into
            a standalone question that can be understood WITHOUT the chat history,
            DO NOT answer - only rephrase.
            If the question is already standalone return it as-is.`,
        ],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"]
    ])
    const rephraseLlmWithParser = llmForRephrase.pipe(new StringOutputParser());

    const historyAwareRetriever = await createHistoryAwareRetriever({
        llm: rephraseLlmWithParser,
        retriever: retriver,
        rephrasePrompt: rephrasePrompt
    })

    console.log("QA prompt template started")
    const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system",
            `You are a helpful assistent for answering questions about documents.
          Use the retrived context below to answer the question.
          If the answer is't in the context, say- "I do not have answer about that in the the documents."
          Keep answer clear and concise.

          Context: {context},
            `],
        new MessagesPlaceholder("chat_history"),
        [
            "human", "{input}"
        ]
    ])
    // Stuffs retrieved docs into the {context} placeholder
    const qaChain = await createStuffDocumentsChain({ llm: llmForQa, prompt: qaPrompt })

    // Combines history-aware retriever + QA chain
    const ragChain = await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain: qaChain
    })

    const conversationChain = new RunnableWithMessageHistory({
        runnable: ragChain,
        getMessageHistory: getSessionHistory,
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
        outputMessagesKey: "answer",
    })
    return conversationChain

}

