const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs").promises; // Use promises API of fs
const path = require("path"); // Import path module

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

require("dotenv").config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/tts", async (req, res) => {
  console.log("Received TTS request");
  const { text } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1",
        voice: "alloy",
        input: text,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        responseType: "arraybuffer", // Important to get binary data
      }
    );

    const audioBuffer = Buffer.from(response.data);
    const audioFilePath = path.resolve("./speech.mp3");
    await fs.writeFile(audioFilePath, audioBuffer);

    res.sendFile(audioFilePath); // Serve the audio file
  } catch (error) {
    console.error("Error generating TTS audio:", error.message);
    res.status(500).json({ error: "Failed to generate TTS audio" });
  }
});

// Route to handle chat messages
app.post("/chat", async (req, res) => {
  const { messages, functions } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-0613",
        messages,
        functions,
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error communicating with OpenAI API:", error.message);
    res.status(500).json({ error: "Failed to communicate with OpenAI API" });
  }
});

// Fetch question from external API

app.get("/question/:difficulty", async (req, res) => {
  const { difficulty } = req.params;
  console.log("Received request for difficulty level:", difficulty);

  const difficultyFile = ["easy.txt", "medium.txt", "hard.txt"];
  const selectedFile = difficultyFile[difficulty];
  console.log("Selected file:", selectedFile);

  if (!selectedFile) {
    console.error("Invalid difficulty level received:", difficulty);
    return res.status(400).json({ error: "Invalid difficulty level" });
  }

  try {
    // Read the file from the local filesystem
    const filePath = `./question_slugs/${selectedFile}`;
    const text = await fs.readFile(filePath, "utf-8");

    const slugs = text.split("\n").filter((slug) => slug.trim());
    const randomSlug = slugs[Math.floor(Math.random() * slugs.length)];
    console.log("Selected question slug:", randomSlug);
    const apiResponse = await fetch(
      `https://alfa-leetcode-api.onrender.com/select?titleSlug=${randomSlug}`
    );
    if (!apiResponse.ok) throw new Error("API request failed");

    const result = await apiResponse.json();

    if (result.question) {
      console.log("Question fetched successfully:", result.question);
      res.json({ question: result.question });
    } else {
      console.error("Failed to fetch question details");
      res.status(500).json({ error: "Failed to fetch question details" });
    }
  } catch (error) {
    console.error("Error fetching question:", error.message);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

  
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
