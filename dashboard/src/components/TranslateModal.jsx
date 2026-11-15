import React, { useState } from 'react';
import { Loader2, Languages, Sparkles } from 'lucide-react';
import Modal from './ui/Modal';

const LANGUAGES = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "hi": "Hindi",
    "ur": "Urdu",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "ru": "Russian",
    "tr": "Turkish",
    "nl": "Dutch",
    "sv": "Swedish",
    "id": "Indonesian",
    "fil": "Filipino",
    "ms": "Malay",
    "vi": "Vietnamese",
    "th": "Thai",
    "uk": "Ukrainian",
    "el": "Greek",
    "cs": "Czech",
    "fi": "Finnish",
    "ro": "Romanian",
    "da": "Danish",
    "bg": "Bulgarian",
    "hr": "Croatian",
    "sk": "Slovak",
    "ta": "Tamil",
    "en": "English",
};

export default function TranslateModal({ isOpen, onClose, onTranslate, isProcessing, videoUrl }) {
    const [targetLanguage, setTargetLanguage] = useState('es');
    const [voiceGender, setVoiceGender] = useState('female');

    if (!isOpen) return null;

    const handleSubmit = () => {
        onTranslate({ targetLanguage, voiceGender });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={isProcessing ? undefined : onClose}
            eyebrow="FREE NEURAL DUBBING"
            title="dub voice"
            size="md"
            footer={
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="btn-ghost flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isProcessing}
                        className="btn-primary flex-1"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Dubbing...
                            </>
                        ) : (
                            <>
                                <Languages size={16} />
                                Dub Voice (Free)
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-input bg-paper3 flex items-center justify-center shrink-0">
                        <Languages size={18} className="text-brass" />
                    </div>
                    <div>
                        <p className="text-xs text-ink font-medium">100% Free Neural Voice Dubbing</p>
                        <p className="text-xs text-muted">Edge Neural TTS + AI Translation ($0.00 cost, no API key needed)</p>
                    </div>
                </div>
                <span className="badge-ok shrink-0"><Sparkles size={11} /> $0.00</span>
            </div>

            {/* Preview */}
            <div className="mb-5 rounded-card overflow-hidden bg-black aspect-video">
                <video
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                />
            </div>

            {/* Language Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                    <label className="eyebrow block mb-2">
                        Target Language
                    </label>
                    <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="input-field appearance-none cursor-pointer"
                        disabled={isProcessing}
                    >
                        {Object.entries(LANGUAGES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                            <option key={code} value={code}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="eyebrow block mb-2">
                        Neural Voice Style
                    </label>
                    <div className="flex gap-2">
                        {['female', 'male'].map((g) => (
                            <button
                                key={g}
                                type="button"
                                disabled={isProcessing}
                                onClick={() => setVoiceGender(g)}
                                className={`flex-1 py-2.5 px-3 rounded-input text-xs font-medium uppercase tracking-wider border transition-colors ${
                                    voiceGender === g
                                        ? 'bg-ink text-paper border-ink'
                                        : 'bg-paper2 text-muted border-rule hover:text-ink'
                                }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info */}
            <p className="text-xs text-muted leading-relaxed mb-2">
                Your clip's speech is translated and synthesized with native neural prosody, time-aligned to each spoken phrase, and mixed over ducked background ambience.
            </p>

            <p className="text-xs text-muted leading-relaxed mb-2">
                The dubbed file is tagged as AI-generated content. When you publish it, disclose that the voice is synthetic.
            </p>

            {/* Processing State */}
            {isProcessing && (
                <div className="mt-4 p-3 bg-paper3 rounded-input">
                    <div className="flex items-center gap-3">
                        <Loader2 size={18} className="text-brass animate-spin" />
                        <div>
                            <p className="text-sm text-ink font-medium lowercase">Translating & dubbing audio...</p>
                            <p className="text-xs text-muted lowercase">Aligning neural voice segments with FFmpeg</p>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
