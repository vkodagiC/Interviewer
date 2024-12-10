import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [showDifficultySelection, setShowDifficultySelection] = useState(true); // Controls difficulty selection screen
  const [chat, setChat] = useState([
    {
      role: "system",
      content:
        `You are a technical interviewer. Ask the candidate 4-5 technical questions from Operating 
        systems and networks. Ask one question, wait for them to answer, then ask the next one. 
        After this, you will move on to the coding round. You will give the candidate a choice
        to have an easy, medium, or hard interview. If they select easy, ask them 1 easy question and
        1 medium question one after the other. If they select medium, ask them 2 medium questions.
        If they select hard, ask them 1 hard question. If you have to ask 2 questions, i.e., when
        they select easy or medium level of interview, only ask the next question if they have 
        done the previous one correctly or given up on it. The candidate will provide code for the
        question. If it is correct, do not explain the solution, ask them what is happening in the code
        and verify if what they said is what is being asked to solve in the question and what is written.
        If it is wrong, give them hints, never give them a full solution. At the end of the interview,
        write a detailed summary on what topics they should focus more on depending on what they got wrong.`,
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
  const [questionCount, setQuestionCount] = useState(0); // Number of LeetCode-style questions asked
  const [maxQuestions, setMaxQuestions] = useState(0); // Maximum questions for this session

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

  const fetchQuestion = async (difficulty) => {
    try {
      const response = await axios.get(`http://localhost:5001/question/${difficulty}`);
      return response.data.question; // Return the question
    } catch (error) {
      console.error("Error fetching question:", error.message);
      return "Failed to fetch question.";
    }
  };

  const displayQuestionAndEditor = (question) => {
    setCurrentQuestion(question);
    setCandidateCode(""); // Clear the editor for a new question
  };

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

      await sleep(3000);

      setChat([...newChat, assistantMessage]);

      if (assistantMessage.function_call) {
        const { name, arguments: args } = assistantMessage.function_call;

        let parsedArgs;
        try {
          parsedArgs = JSON.parse(args);
        } catch (error) {
          console.error("Failed to parse function call arguments:", error);
          return;
        }

        if (name === "fetch_question") {
          if (questionCount >= maxQuestions) {
            setChat([...chat, { role: "assistant", content: "That's the end of the coding round!" }]);
            return;
          }

          const question = await fetchQuestion(parsedArgs.difficulty);
          displayQuestionAndEditor(question);
          setQuestionCount((prev) => prev + 1);
          playAudioResponse("Your question has been displayed on the right. Please take a look.");
          await sleep(3000);
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

  const handleDifficultySelection = (difficulty) => {
    setShowDifficultySelection(false); // Hide difficulty selection screen
    setChat((prev) => [
      ...prev,
      { role: "assistant", content: `Difficulty level selected: ${difficulty}. Let's begin!` },
    ]);

    if (difficulty === "easy") setMaxQuestions(2);
    else if (difficulty === "medium") setMaxQuestions(2);
    else if (difficulty === "hard") setMaxQuestions(1);
  };

  if (showDifficultySelection) {
    return (
      <div className="container mt-5">
        <h1 className="text-center mb-4">Welcome to the Interview</h1>
        <h4 className="text-center mb-4">Please select your difficulty level to begin:</h4>
        <div className="d-flex justify-content-center">
          <button className="btn btn-primary mx-2" onClick={() => handleDifficultySelection("easy")}>
            Easy
          </button>
          <button className="btn btn-warning mx-2" onClick={() => handleDifficultySelection("medium")}>
            Medium
          </button>
          <button className="btn btn-danger mx-2" onClick={() => handleDifficultySelection("hard")}>
            Hard
          </button>
        </div>
      </div>
    );
  }

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
