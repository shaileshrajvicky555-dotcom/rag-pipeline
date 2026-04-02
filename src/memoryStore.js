// import { ChatMessageHistory } from "@langchain/stores/message/in_memory";
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";

const sessionStore = {}

export function getSessionHistory(sessionId){
    if(!sessionStore[sessionId]){
      console.log("New session Id createde", sessionId);
      sessionStore[sessionId] = new ChatMessageHistory()
    }
    return sessionStore[sessionId]
}

export async function getSessionMessages(sessionId){
  if(!sessionStore[sessionId]) return [];
  const history = sessionStore[sessionId]
  return await history.getSessionMessages()
}

export function clearSession(sessionId){
    delete sessionStore[sessionId]
    console.log("Session Id deleted")
}

export function listSessions() {
  return Object.keys(sessionStore);
}