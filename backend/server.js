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
  const { messages } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-0613",
        messages,
        functions: [
          {
            name: "fetch_question",
            description: "Fetches a question from the backend based on difficulty",
            parameters: {
              type: "object",
              properties: {
                difficulty: { type: "string" },
              },
              required: ["difficulty"],
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
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

  const difficultyFileMap = {
    easy: "easy.txt",
    medium: "medium.txt",
    hard: "hard.txt",
  };

  const selectedFile = difficultyFileMap[difficulty];
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
    let questionFound = false;
    let randomSlug, apiResponse, result;

    while (!questionFound) {
      randomSlug = slugs[Math.floor(Math.random() * slugs.length)];
      console.log("Selected question slug:", randomSlug);

      apiResponse = await fetch(
        `https://alfa-leetcode-api.onrender.com/select?titleSlug=${randomSlug}`
      );
      if (!apiResponse.ok) {
        console.error("API request failed for slug:", randomSlug);
        continue; // Retry with a different slug
      }

      result = await apiResponse.json();

      // Check if the question is valid and not paid-only
      if (result && !result.isPaidOnly && result.question) {
        questionFound = true;
      } else {
        console.log(
          `Skipping slug "${randomSlug}" - isPaidOnly: ${result.isPaidOnly}, question exists: ${
            result.question ? true : false
          }`
        );
      }
    }

    console.log("Question fetched successfully:", result.question);
    res.json({ question: result.question });
  } catch (error) {
    console.error("Error fetching question:", error.message);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});


  
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
