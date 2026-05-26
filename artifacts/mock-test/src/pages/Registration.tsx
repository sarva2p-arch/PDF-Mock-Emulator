import { useState } from "react";

interface RegistrationProps {
  onStart: (name: string, rollNumber: string, duration: number) => void;
  onBack: () => void;
  customTitle?: string;
  customQuestionCount?: number;
  isDark?: boolean;
  onToggleDark?: () => void;
}

export default function Registration({ onStart, onBack, customTitle, customQuestionCount, isDark, onToggleDark }: RegistrationProps) {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [duration, setDuration] = useState<string>("140");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; rollNumber?: string; duration?: string; agreed?: string }>({});

  const title = customTitle ?? "Mock Test";
  const questionCount = customQuestionCount ?? 0;

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Please enter your full name";
    if (!rollNumber.trim()) newErrors.rollNumber = "Please enter your roll number";
    const dur = Number(duration);
    if (!duration || isNaN(dur) || dur < 1 || dur > 360) newErrors.duration = "Please enter a valid duration (1–360 minutes)";
    if (!agreed) newErrors.agreed = "You must agree to the instructions to proceed";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onStart(name.trim().toUpperCase(), rollNumber.trim(), Number(duration));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="bg-blue-700 text-white rounded-t-xl p-6 text-center shadow-lg relative">
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-white"
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}
          <div className="text-sm font-medium tracking-wider uppercase text-blue-200 mb-1">Dhanusha Academy</div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="bg-blue-800 rounded-lg px-4 py-2">
              <div className="text-blue-300 text-xs">Total Questions</div>
              <div className="font-bold">{questionCount}</div>
            </div>
            <div className="bg-blue-800 rounded-lg px-4 py-2">
              <div className="text-blue-300 text-xs">Marks</div>
              <div className="font-bold">{questionCount}</div>
            </div>
            <div className="bg-blue-800 rounded-lg px-4 py-2">
              <div className="text-blue-300 text-xs">Negative Marking</div>
              <div className="font-bold">None</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-lg">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">General Instructions</h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>This exam contains <strong>{questionCount} questions</strong>. Each correct answer carries <strong>1 mark</strong>.</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>There is <strong>no negative marking</strong>. The exam will auto-submit when time expires.</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>Use the <strong>question palette</strong> on the right to navigate between questions.</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>You can <strong>mark questions for review</strong> and come back to them later.</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>Click <strong>Save &amp; Next</strong> to save your answer and move to the next question.</span></li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold mt-0.5">•</span><span>Do not refresh or close the browser during the exam.</span></li>
            </ul>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Question Status Legend</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-gray-300 flex items-center justify-center text-xs font-bold">1</div>
                  <span className="text-gray-600 dark:text-gray-300">Not Visited</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-xs font-bold text-white">1</div>
                  <span className="text-gray-600 dark:text-gray-300">Not Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-green-600 flex items-center justify-center text-xs font-bold text-white">1</div>
                  <span className="text-gray-600 dark:text-gray-300">Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-purple-700 flex items-center justify-center text-xs font-bold text-white">1</div>
                  <span className="text-gray-600 dark:text-gray-300">Marked for Review</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide">Candidate Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
                  placeholder="Enter your full name (in capitals)"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 ${errors.name ? "border-red-400 bg-red-50 dark:bg-red-950" : "border-gray-300 dark:border-gray-600"}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Roll Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => { setRollNumber(e.target.value); setErrors((prev) => ({ ...prev, rollNumber: undefined })); }}
                  placeholder="Enter your roll number"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 ${errors.rollNumber ? "border-red-400 bg-red-50 dark:bg-red-950" : "border-gray-300 dark:border-gray-600"}`}
                />
                {errors.rollNumber && <p className="text-red-500 text-xs mt-1">{errors.rollNumber}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={duration}
                  onChange={(e) => { setDuration(e.target.value); setErrors((prev) => ({ ...prev, duration: undefined })); }}
                  placeholder="e.g. 140"
                  className={`w-40 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition dark:bg-gray-700 dark:text-gray-100 ${errors.duration ? "border-red-400 bg-red-50 dark:bg-red-950" : "border-gray-300 dark:border-gray-600"}`}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">minutes (set your own time limit)</span>
              </div>
              {errors.duration && <p className="text-red-500 text-xs mt-1">{errors.duration}</p>}
            </div>

            <div className={`flex items-start gap-2 p-3 rounded-lg border ${errors.agreed ? "border-red-400 bg-red-50 dark:bg-red-950" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"}`}>
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); setErrors((prev) => ({ ...prev, agreed: undefined })); }}
                className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="agree" className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                I have read and understood all the instructions. I agree to follow the exam rules and understand that the exam will auto-submit when the time expires.
              </label>
            </div>
            {errors.agreed && <p className="text-red-500 text-xs -mt-2">{errors.agreed}</p>}

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors text-sm shadow-sm"
            >
              Start Exam
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
            >
              ← Go back
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
