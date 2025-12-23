# Mini AI Live Chat Agent

A small web app that simulates a customer support chat where an AI agent answers user questions using the OpenAI API.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, Prisma, SQLite
- **Frontend:** Svelte (Vite), Tailwind CSS, TypeScript
- **AI:** OpenAI API (gpt-3.5-turbo)

## Prerequisites

- Node.js (v16+)
- npm
- OpenAI API Key

## Setup & Run

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` directory:
   ```env
   PORT=3001
   DATABASE_URL="file:./dev.db"
   OPENAI_API_KEY="your_openai_api_key_here"
   ```
4. Initialize the database:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:3001`.

### 3. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to `http://localhost:5173`.

## Architecture Overview

### Backend (`/backend`)
- **`src/index.ts`**: Main entry point. Sets up Express server, middleware, and routes.
- **`src/llm.ts`**: Handles interaction with OpenAI API. Contains the system prompt and FAQ logic.
- **`prisma/schema.prisma`**: Defines the database schema (Conversation, Message).
- **Routes**:
  - `POST /chat/message`: Handles user messages, persists them, calls LLM, and returns the response.
  - `GET /chat/history/:sessionId`: Retrieves conversation history.

### Frontend (`/frontend`)
- **`src/App.svelte`**: Main component containing the chat UI and logic.
- **State Management**: Uses Svelte's local state and `localStorage` to persist `sessionId` across reloads.
- **Styling**: Tailwind CSS for rapid and responsive styling.

## Features

- **Real-time Chat**: Send messages and get instant AI responses.
- **Context Awareness**: The AI remembers the conversation context (last 10 messages).
- **Persistence**: All messages are stored in a SQLite database.
- **Session Recovery**: Reloading the page restores the previous conversation.
- **Domain Knowledge**: The AI knows about "GadgetStore" policies (shipping, returns, etc.).
- **Robustness**: Handles empty messages, API errors, and network failures gracefully.

## Trade-offs & Future Improvements

- **Security**: Currently, there is no authentication. Anyone can access any session if they know the UUID. In a real app, we'd add user auth (JWT/OAuth).
- **Scalability**: SQLite is used for simplicity. For production, PostgreSQL would be better.
- **LLM Optimization**: We use a simple prompt. Retrieval Augmented Generation (RAG) could be implemented for larger knowledge bases.
- **Streaming**: Responses are currently returned fully generated. Streaming tokens (Server-Sent Events) would improve perceived latency.
