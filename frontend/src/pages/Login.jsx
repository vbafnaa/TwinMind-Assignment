import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import ReCAPTCHA from "react-google-recaptcha";
import Webcam from "react-webcam";
import axios from "axios";

const videoConstraints = {
  width: 100,
  height: 100,
  facingMode: "user",
  mirrored: "False",
};

const recaptchaTestKey = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState("");
  const webcamRef = useRef(null);
  const [captchaIsDone, setCaptchaDone] = useState(false);

  const handleFileChange = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    const blob = await (await fetch(imageSrc)).blob();
    setFile(new File([blob], "image.jpg", { type: "image/jpeg" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaIsDone || !file) return;
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);
    formData.append("img", file);
    try {
      const res = await axios.post(
        "https://fcd2-34-125-55-159.ngrok-free.app/login/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (res.data.message === "Login Successful") {
        localStorage.setItem("flag", "true");
        localStorage.setItem("name", res.data.name);
        localStorage.setItem("access_token", res.data.access_token);
        navigate("/twinmind");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-indigo-50/60 text-slate-900">
      <Navbar />
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-8 shadow-xl shadow-slate-300/40 backdrop-blur">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to TwinMind. Face capture is required by the existing backend.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-indigo-500/0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-inner outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-center text-sm font-medium text-slate-700">
                Verify it’s you — capture your face
              </p>
              <div className="mt-3 flex justify-center">
                {file === "" ? (
                  <Webcam
                    audio={false}
                    height={200}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    width={220}
                    mirrored={true}
                    videoConstraints={videoConstraints}
                    className="overflow-hidden rounded-xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <p className="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
                    Image captured
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-center gap-2">
                {file !== "" ? (
                  <button
                    type="button"
                    onClick={() => setFile("")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Retake
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleFileChange()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    Capture
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center overflow-x-auto">
              <ReCAPTCHA sitekey={recaptchaTestKey} onChange={() => setCaptchaDone(true)} />
            </div>

            <button
              type="submit"
              disabled={!captchaIsDone || file === ""}
              className="w-full rounded-xl bg-[#0f172a] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sign in
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            New here?{" "}
            <Link
              to="/Signup"
              className="font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
