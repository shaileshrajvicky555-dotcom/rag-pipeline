import "dotenv/config"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from '@langchain/groq';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { RunnablePassthrough, RunnableMap, RunnableLambda, RunnableSequence } from "@langchain/core/runnables"
import { StringOutputParser } from '@langchain/core/output_parsers';

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
//     const ragChainWithSource = RunnableSequence.from([
//         {
//             context: retriever.pipe(formatDocs),
//             question: new RunnablePassthrough,
//             sourceDocs: retriever
//         },
//         {
//             answer: RunnableSequence.from([
//                 (input) => ({ context: input.context, question: input.question }),
//                 prompt,
//                 llm,
//                 new StringOutputParser()
//             ]),
//             source: (input) =>
//                 [...new Map(
//                     input.sourceDocs.map((doc) => [
//                         `${doc.metadata.source}-${doc.metadata.loc?.pageNumber}`,
//                         {
//                             file: doc.metadata.source?.split("/").pop(), // just the filename
//                             page: doc.metadata.loc?.pageNumber ?? "N/A",
//                         },
//                     ])
//                 ).values()]
//         }
//     ])

//     return ragChainWithSource
// }



//Streaming data

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
        model: 'openai/gpt-oss-20b',
        temperature: 0,
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

// For .invoke() — returns { answer, sources }
export async function buildRagChain() {
    const { retriver, llm, prompt, extractSources, formatDocuments } = await getChainParts();
    const ragChain = RunnableSequence.from([
        {
            context: retriver.pipe(formatDocuments),
            question: new RunnablePassthrough(),
            source: retriver
        },
        {
            answer: RunnableSequence.from([
                (input) => ({ context: input.context, question: input.question }),
                prompt,
                llm,
                new StringOutputParser()
            ]),
            source: (input) => extractSources(input.sourceDocs),
        },
    ])
    return ragChain
}

// For .stream() — streams tokens + sources separately

export async function buildStremingRagChain() {
    const { retriver, llm, prompt, formatDocs, extractSources } = await getChainParts();
//      console.log("WE ARE HERE   ")
//       const retrieveDocs = RunnableLambda.from((question) =>
//     retriver.getRelevantDocuments(question)
//   );
//     const retrivalChain = RunnableSequence.from([
//         {
//             context: retrieveDocs.pipe(formatDocs),
//             question: new RunnablePassthrough(),
//             sourceDocs: retrieveDocs,   // stash raw docs for metadata
//         },

//     ]);

const retrieveDocs = RunnableLambda.from(async (question) => {
    const docs = await retriver.getRelevantDocuments(question);
    return {
      docs,
      context: formatDocs(docs),
    };
  });

  const retrivalChain = RunnableSequence.from([
    {
      data: retrieveDocs,
      question: new RunnablePassthrough(),
    },
    {
      context: (input) => input.data.context,
      sourceDocs: (input) => input.data.docs,
      question: (input) => input.question,
    },
  ]);

    console.log("Checking retrived Data")
    const retrivedData = await retriver.getRelevantDocuments("Who is Shailesh");
    console.log("Retrived data finish");

    const generationChain = RunnableSequence.from([
        (input) => ({ context: input.context, question: input.question }),
        prompt,
        llm,
        // new StringOutputParser()
    ])

    return { retrivalChain, generationChain, extractSources }
}



// const retrivalChain = RunnableSequence.from([
//     // {
//     //     context: retriever.pipe(formatDocs),
//     //     question: new RunnablePassthrough(),
//     //     source: retriever
//     // }
//    {
//     context: retriever.pipe(formatDocs),
//     context: retriever.pipe(
//         new RunnableLambda({
//             func: formatDocs,
//         })
//     ),
//     question: new RunnablePassthrough(),
// }
// ])