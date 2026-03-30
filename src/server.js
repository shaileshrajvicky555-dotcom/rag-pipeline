import "dotenv/config"
import express from "express"
import cors from "cors"
import { buildStremingRagChain } from "./chain.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });

    try {
        const { retrievalChain, generationChain, extractSources } =
            await buildStremingRagChain ();

        const retrieved = await retrievalChain.invoke(question);
        const sources = extractSources(retrieved.sourceDocs);

        const stream = await generationChain.stream({
            context: retrieved.context,
            question,
        });

        let answer = "";
        for await (const chunk of stream) answer += chunk;

        res.json({ answer, sources });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/ask/stream", async (req, res) => {
    const { question } = req.query;
    if (!question) return res.status(404).json({ error: "question is required" });

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
        const { retrivalChain, generationChain, extractSources } = await buildStremingRagChain();

        const retrived = await retrivalChain.invoke({ question: question });
        const source = extractSources(retrived.sourceDocs);
        
        sendEvent("sources", {sources: source});
        const stream = await generationChain.stream({
            context: retrived.context,
            question: question
        })
        console.log("streming.....")
        for await (const chunk of stream) {
            sendEvent("token", { token: chunk.content })
            await new Promise(r => setTimeout(r, 500)); //
        }
        
        sendEvent("done", { message: "stream completed" })
    } catch (err) {
        sendEvent("error", { message: err.message });
    } finally {
        res.end(); // close the SSE connection
    }
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`🚀 RAG Server running at http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: GET http://localhost:${PORT}/ask/stream?question=...`);
})