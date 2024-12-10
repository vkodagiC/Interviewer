import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [chat, setChat] = useState([
    {
      role: "system",
      content:
        `You are a technical interviewer. Ask the candidate 4-5 technical questions from Operating 
        systems and networks. Ask one question, wait for them to answer, then ask the next one. 
        Then ask them 2 leetcode-style questions. The user will provide code for the question. If it 
        is correct, do not explain the solution, ask them what is happening in the code and verify 
        if what they said is what is being asked to solve in the question and what is written in their 
        solution. If it is wrong, give them hints, never give them a full solution. If they select
        easy - you call the function to get one easy question and one medium question. 
        If they ask for medium, you must ask two medium questions. If they ask for hard, ask only
        one hard question. Also only ask the next question if you are satisfied with the answer
        or they give up for the question. At the end of the interview, write a detailed summary 
        on what topics they should focus more on depending on what they got wrong.`,
    },
    { role: "assistant", content: "Hello! I am your interviewer for today. Please introduce yourself." },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [candidateCode, setCandidateCode] = useState(""); // Candidate's code
  const [language, setLanguage] = useState("c++"); // Default language
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 1 hour in seconds
  const [isLoading, setIsLoading] = useState(false); // Typing indicator

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  // Start speech recognition
  const startListening = () => {
    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript); // Update input with speech
    };

    recognition.onend = () => {
      setIsListening(false); // Stop listening when speech ends
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };
  };

  // Fetch a question from the backend
  const fetchQuestion = async (difficulty) => {
    try {
      const response = await axios.get(`http://localhost:5001/question/${difficulty}`);
      return response.data.question; // Return the question
    } catch (error) {
      console.error("Error fetching question:", error.message);
      return "Failed to fetch question.";
    }
  };

  // Display the question and editor
  const displayQuestionAndEditor = (question) => {
    setCurrentQuestion(question);
    setCandidateCode(""); // Clear the editor for a new question
  };

  // Play TTS audio
  const playAudioResponse = async (text) => {
    try {
      const response = await axios.post("http://localhost:5001/tts", { text }, { responseType: "blob" });
      const audioUrl = URL.createObjectURL(new Blob([response.data], { type: "audio/mpeg" }));
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error("Error playing TTS audio:", error.message);
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Submit the code for ChatGPT feedback
  const submitCode = async () => {
    const newChat = [...chat, { role: "user", content: candidateCode }];
    setChat(newChat);

    try {
      const response = await axios.post("http://localhost:5001/chat", {
        messages: newChat,
      });

      const { choices } = response.data;
      const assistantMessage = choices[0].message;

      setChat([...newChat, assistantMessage]);
    } catch (error) {
      console.error("Error submitting code:", error.message);
    }
  };

  // Send user input to ChatGPT
  const sendMessage = async () => {
    const newChat = [...chat, { role: "user", content: userInput }];
    setChat(newChat);
    setIsLoading(true); // Show typing indicator

    try {
      const response = await axios.post("http://localhost:5001/chat", {
        messages: newChat,
      });

      const { choices } = response.data;
      const assistantMessage = choices[0].message;

      
      playAudioResponse(assistantMessage.content);

      await sleep(2000);

      setChat([...newChat, assistantMessage]);
      // Handle function calls
      if (assistantMessage.function_call) {
        const { name, arguments: args } = assistantMessage.function_call;

        // Parse arguments
        let parsedArgs;
        try {
          parsedArgs = JSON.parse(args);
        } catch (error) {
          console.error("Failed to parse function call arguments:", error);
          return;
        }

        if (name === "fetch_question") {
          const question = await fetchQuestion(parsedArgs.difficulty);
          displayQuestionAndEditor(question);

          // Add a ChatGPT response acknowledging the question
          setChat([
            ...newChat,
            { role: "assistant", content: "Your question has been displayed on the right. Please take a look." },
          ]);
        } else if (name === "display_question_and_editor") {
          displayQuestionAndEditor(parsedArgs.question);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error.message);
    } finally {
      setIsLoading(false); // Hide typing indicator
    }

    setUserInput("");
  };

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">ChatGPT Technical Interviewer</h1>
      <div className="text-center mb-4">
        <h4>
          Time Remaining: <span className="text-danger">{formatTime(timeLeft)}</span>
        </h4>
      </div>
      <div className="row">
        <div className="col-md-6">
          <div className="chat-box border p-3 rounded mb-3" style={{ height: "400px", overflowY: "auto" }}>
            {chat.filter((message) => message.role !== "system").map((message, index) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded ${
                  message.role === "assistant" ? "bg-light" : "bg-primary text-white"
                }`}
              >
                {message.content}
              </div>
            ))}
            {isLoading && (
              <div className="mb-2 p-2 rounded bg-light text-muted">
                ChatGPT is typing...
              </div>
            )}
          </div>
          <div className="input-group">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="form-control"
              placeholder="Type your response..."
            />
            <button className="btn btn-primary" onClick={sendMessage}>
              Send
            </button>
            <button
              className={`btn ${isListening ? "btn-danger" : "btn-secondary"} ms-2`}
              onClick={startListening}
              disabled={isListening}
            >
              {isListening ? "Listening..." : "Speak"}
            </button>
          </div>
        </div>
        <div className="col-md-6">
          {currentQuestion ? (
            <div>
              <h3>Question</h3>
              <div
                className="border p-3 rounded mb-3"
                dangerouslySetInnerHTML={{ __html: currentQuestion }}
              />
              <div className="mb-3">
                <label htmlFor="language-select" className="form-label">
                  Select Language
                </label>
                <select
                  id="language-select"
                  className="form-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                </select>
              </div>
              <Editor
                height="200px"
                language={language}
                value={candidateCode}
                theme="vs-dark"
                onChange={(newValue) => setCandidateCode(newValue || "")}
                options={{ fontSize: 14 }}
              />
              <button className="btn btn-success mt-3" onClick={submitCode}>
                Submit Solution
              </button>
            </div>
          ) : (
            <div className="text-muted">No question selected yet. Waiting for ChatGPT...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
