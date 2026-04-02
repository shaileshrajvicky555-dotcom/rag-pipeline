import "dotenv/config"
import express from "express"
import cors from "cors"
import { buildConversationalRagChain, buildStremingRagChain } from "./chain.js";
import { clearSession, getSessionMessages } from "./memoryStore.js";

const app = express();
app.use(cors());
app.use(express.json());

const ragChain = await buildConversationalRagChain();
console.log("🧠 Conversational RAG chain ready!");

// app.post("/ask", async (req, res) => {
//     const { question } = req.body;
//     if (!question) return res.status(400).json({ error: "question is required" });

//     try {
//         const { retrievalChain, generationChain, extractSources } =
//             await buildStremingRagChain();

//         const retrieved = await retrievalChain.invoke(question);
//         const sources = extractSources(retrieved.sourceDocs);

//         const stream = await generationChain.stream({
//             context: retrieved.context,
//             question,
//         });

//         let answer = "";
//         for await (const chunk of stream) answer += chunk;

//         res.json({ answer, sources });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// app.get("/ask/stream", async (req, res) => {
//     const { question } = req.query;
//     if (!question) return res.status(404).json({ error: "question is required" });

//     res.setHeader("Content-Type", "text/event-stream")
//     res.setHeader("Cache-Control", "no-cache")
//     res.setHeader("Connection", "keep-alive")
//     res.setHeader("Content-Encoding", "none");
//     res.flushHeaders()

//     const sendEvent = (type, data) => {
//     res.write(`event: ${type}\n`);
//     res.write(`data: ${JSON.stringify(data)}\n\n`);
// };

//     try {
//         const { retrivalChain, generationChain, extractSources } = await buildStremingRagChain();

//         const retrived = await retrivalChain.invoke({ question: question });
//         const source = extractSources(retrived.sourceDocs);

//         sendEvent("sources", {sources: source});
//         const stream = await generationChain.stream({
//             context: retrived.context,
//             question: question
//         })
//         console.log("streming.....")
//         for await (const chunk of stream) {
//             sendEvent("token", { token: chunk.content })
//             await new Promise(r => setTimeout(r, 500)); //
//         }

//         sendEvent("done", { message: "stream completed" })
//     } catch (err) {
//         sendEvent("error", { message: err.message });
//     } finally {
//         res.end(); // close the SSE connection
//     }
// })

//   stream with memory

app.get("/ask/stream", async (req, res) => {
    const { question, sessionId } = req.query;
    if (!question) return res.status(404).json({ error: "question is required" });
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("Content-Encoding", "none");
    res.flushHeaders()

    const sendEvent = (type, data) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        console.log("Searching documents...")
        sendEvent("status", { message: "🔍 Searching documents..." });

        const config = {
            configurable: { sessionId },
        }

        // const stream = await ragChain.stream(
        //     { input: question },
        //     config
        // )

        // let sourceDocs = [];
        // for await (const chunk of stream) {
        //     console.log("Streamed data", chunk)
        //     if (chunk?.context) {
        //         sourceDocs = chunk?.context?.map((doc) => ({
        //             file: doc?.metadata?.source?.split("/").pop(),
        //             page: doc?.metadata?.loc?.pageNumber ?? "N/A",
        //         }));
        //         sourceDocs = [...new Map(
        //             sourceDocs.map((s) => [`${s.file}-${s.page}`, s])
        //         ).values()];
        //         sendEvent("sources", { sources: sourceDocs });
        //     }

        //     if (chunk?.answer) {
        //         sendEvent("token", { token: chunk.answer });
        //     }
        // }
        
        // ✅ Use streamEvents v2 instead of .stream()
        const eventStream = ragChain.streamEvents(
            { input: question },
            { ...config, version: "v2" }
        );
        console.log("eventStream", eventStream)
        let sourcesEmitted = false;

        for await (const event of eventStream) {
            const { event: eventName, data, tags } = event;

            // ✅ Capture source documents from the retriever step
            if (
                eventName === "on_retriever_end" &&
                !sourcesEmitted
            ) {
                const docs = data?.output ?? [];
                let sourceDocs = docs.map((doc) => ({
                    file: doc?.metadata?.source?.split("/").pop(),
                    page: doc?.metadata?.loc?.pageNumber ?? "N/A",
                }));

                // Deduplicate
                sourceDocs = [...new Map(
                    sourceDocs.map((s) => [`${s.file}-${s.page}`, s])
                ).values()];

                sendEvent("sources", { sources: sourceDocs });
                sourcesEmitted = true;
            }

            // ✅ Stream LLM tokens — filter to only the QA chain's LLM, not the rephrase LLM
            if (eventName === "on_chat_model_stream") {
                const chunk = data?.chunk;
                const token = chunk?.content;
                if (token) {
                    sendEvent("token", { token });
                }
            }
        }
        sendEvent("done", { message: "complete" });

    } catch (err) {
        // ✅ AbortError is expected when client disconnects — not a real crash
        if (err.name === "AbortError") {
            console.log(`Stream aborted for session ${sessionId} (client disconnected)`);
            return; // Don't try to write to the response
        }
        console.error("Streaming error:", err);
        sendEvent("error", { message: err.message });
    } finally {
        await new Promise(r => setTimeout(r, 1000)); 
        res.end();
    }
})
process.on("unhandledRejection", (reason, promise) => {
    if (reason?.name === "AbortError") {
        // Expected — LangChain aborts internally on stream cancellation
        return;
    }
    console.error("Unhandled Rejection:", reason);
});
app.get("/history/:sessionId", async (req, res) => {
    const messages = await getSessionMessages(req.params.sessionId);

    // Format messages for the frontend
    const formatted = messages.map((msg) => ({
        role: msg._getType() === "human" ? "user" : "assistant",
        content: msg.content,
    }));

    res.json({ sessionId: req.params.sessionId, messages: formatted });
});

app.delete("/history/:sessionId", (req, res) => {
    clearSession(req.params.sessionId);
    res.json({ message: `Session ${req.params.sessionId} cleared` });
});

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`🚀 RAG Server running at http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: GET http://localhost:${PORT}/ask/stream?question=...`);
})