import React, { useState, useRef, useEffect, useCallback } from "react";
import "./assess.css";
import { v4 as uuidv4 } from "uuid";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";
import Webcam from "react-webcam";
import { useDispatch, useSelector } from "react-redux";
import { addSignData } from "../../redux/actions/signdataaction";
import ProgressBar from "../Detect/ProgressBar/ProgressBar.jsx";

let startTime = "";

const Assess = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [gestureOutput, setGestureOutput] = useState("");
  const [gestureRecognizer, setGestureRecognizer] = useState(null);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [progress, setProgress] = useState(0);
  const signsToAssess = ['Thankyou', 'Hello', 'V']; // List of signs to assess
  const [questionCount, setQuestionCount] = useState(0);
  const [marks, setMarks] = useState(0);
  const [isQuestionAnswered, setIsQuestionAnswered] = useState(false); // Track if the current question is answered

  const requestRef = useRef();

  const [detectedData, setDetectedData] = useState([]);

  const user = useSelector((state) => state.auth?.user);

  const dispatch = useDispatch();

  useEffect(() => {
    async function loadGestureRecognizer() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: process.env.REACT_APP_MODEL_URL,
        },
        numHands: 2,
        runningMode: runningMode,
      });
      setGestureRecognizer(recognizer);
    }
    loadGestureRecognizer();
  }, [runningMode]);

  const predictWebcam = useCallback(() => {
    if (runningMode === "IMAGE") {
      setRunningMode("VIDEO");
      gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();
    const results = gestureRecognizer.recognizeForVideo(
      webcamRef.current.video,
      nowInMs
    );

    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;

    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,
        });

        drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
      }
    }

    if (results.gestures.length > 0) {
      setDetectedData((prevData) => [
        ...prevData,
        {
          SignDetected: results.gestures[0][0].categoryName,
        },
      ]);

      setGestureOutput(results.gestures[0][0].categoryName);
      setProgress(Math.round(parseFloat(results.gestures[0][0].score) * 100));

      // Check if the detected gesture matches the current question
      if (results.gestures[0][0].categoryName === signsToAssess[questionCount]) {
        setIsQuestionAnswered(true); // Mark the question as answered correctly
      }
    } else {
      setGestureOutput("");
      setProgress("");
    }

    if (webcamRunning === true) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [webcamRunning, runningMode, gestureRecognizer, questionCount]);

  const animate = useCallback(() => {
    requestRef.current = requestAnimationFrame(animate);
    predictWebcam();
  }, [predictWebcam]);

  const enableCam = useCallback(() => {
    if (!gestureRecognizer) {
      alert("Please wait for gestureRecognizer to load");
      return;
    }

    if (webcamRunning === true) {
      setWebcamRunning(false);
      cancelAnimationFrame(requestRef.current);

      const endTime = new Date();
      const timeElapsed = (
        (endTime.getTime() - startTime.getTime()) /
        1000
      ).toFixed(2);

      const nonEmptyData = detectedData.filter(
        (data) => data.SignDetected !== "" && data.DetectedScore !== ""
      );

      const resultArray = [];
      let current = nonEmptyData[0];

      for (let i = 1; i < nonEmptyData.length; i++) {
        if (nonEmptyData[i].SignDetected !== current.SignDetected) {
          resultArray.push(current);
          current = nonEmptyData[i];
        }
      }

      resultArray.push(current);

      const countMap = new Map();

      for (const item of resultArray) {
        const count = countMap.get(item.SignDetected) || 0;
        countMap.set(item.SignDetected, count + 1);
      }

      const sortedArray = Array.from(countMap.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      const outputArray = sortedArray
        .slice(0, 5)
        .map(([sign, count]) => ({ SignDetected: sign, count }));

      const data = {
        signsPerformed: outputArray,
        id: uuidv4(),
        username: user?.name || "Guest",
        userId: user?.userId || "Guest",
        createdAt: String(endTime),
        secondsSpent: Number(timeElapsed),
      };

      if (user) {
        dispatch(addSignData(data));
      }
      setDetectedData([]);
    } else {
      setWebcamRunning(true);
      startTime = new Date();
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [
    webcamRunning,
    gestureRecognizer,
    animate,
    detectedData,
    user?.name,
    user?.userId,
    dispatch,
  ]);

  const handleNextOrSubmit = () => {
    if (isQuestionAnswered) {
      setMarks((prevMarks) => prevMarks + 1); // Add 1 mark if the question was answered correctly
    }

    if (questionCount < signsToAssess.length - 1) {
      setQuestionCount((prevCount) => prevCount + 1); // Move to the next question
      setIsQuestionAnswered(false); // Reset the answered flag for the next question
    } else {
      alert(`Assessment completed! Your score is ${marks + (isQuestionAnswered ? 1 : 0)}/${signsToAssess.length}`);
    }
  };

  return (
    <>
      <div className="signlang_detection-container">
        <div style={{ position: "relative" }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            className="signlang_webcam"
          />

          <canvas ref={canvasRef} className="signlang_canvas" />

          <div className="signlang_data-container">
            <button onClick={enableCam}>
              {webcamRunning ? "Stop" : "Start"}
            </button>

            <div className="signlang_data">
              <p className="gesture_output">{gestureOutput}</p>
              {progress ? <ProgressBar progress={progress} /> : null}
            </div>
          </div>
        </div>

        <div className="signlang_imagelist-container">
          <h2 className="gradient__text">Perform: {signsToAssess[questionCount]}</h2>
          <button
            className="next-button"
            onClick={handleNextOrSubmit}
          >
            {questionCount < signsToAssess.length - 1 ? "Next Question" : "Submit"}
          </button>
          <p>Score: {marks + (isQuestionAnswered ? 1 : 0)}/{signsToAssess.length}</p>
        </div>
      </div>
    </>
  );
};

export default Assess;