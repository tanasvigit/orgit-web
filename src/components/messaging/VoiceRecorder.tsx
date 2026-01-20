import React, { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (audioBlob: Blob) => void;
  onClose: () => void;
  visible: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordComplete, onClose, visible }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      stopRecording();
      setRecordingTime(0);
      setAudioBlob(null);
    }
  }, [visible]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordComplete(audioBlob);
      onClose();
    }
  };

  const handleCancel = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={handleCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Note</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 py-6">
          {!audioBlob ? (
            <>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                <span className="material-symbols-outlined text-4xl text-white">
                  {isRecording ? 'mic' : 'mic_none'}
                </span>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-mono font-semibold text-gray-900 dark:text-white mb-2">
                  {formatTime(recordingTime)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isRecording ? 'Recording...' : 'Tap to start recording'}
                </p>
              </div>

              <div className="flex gap-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="bg-primary hover:bg-primary-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
                  >
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-6 py-3 font-medium transition-colors"
                  >
                    Stop Recording
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white">check</span>
              </div>
              
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Recording Complete
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Duration: {formatTime(recordingTime)}
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-full px-6 py-3 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  className="bg-primary hover:bg-primary-dark text-white rounded-full px-6 py-3 font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

