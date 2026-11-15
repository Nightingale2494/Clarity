import React from 'react';
import { ArrowLeft, FileText, Shield, Landmark, Flag } from 'lucide-react';

const LAST_UPDATED = '2026-09-04';

const DOCS = [
    {
        icon: FileText,
        title: 'Terms of Service',
        desc: 'What you can do with Clarity, your content rights, and acceptable use.',
        href: '/terms',
        es: '/terminos',
    },
    {
        icon: Shield,
        title: 'Privacy Policy',
        desc: 'What we store, for how long, which providers touch it, and your privacy rights.',
        href: '/privacy',
        es: '/privacidad',
    },
    {
        icon: Landmark,
        title: 'Legal Notice',
        desc: 'Open source software information and licensing under the MIT License.',
        href: '/legal-notice',
        es: '/aviso-legal',
    },
    {
        icon: Flag,
        title: 'Report Illegal Content',
        desc: 'How to report infringing or illegal content.',
        href: '/report-content',
        es: '/reportar-contenido',
    },
];

export default function Legal() {
    const handleBack = () => {
        window.location.hash = '';
    };

    return (
        <div className="min-h-screen bg-paper text-ink2">
            <header className="border-b border-rule sticky top-0 bg-paper z-10">
                <div className="max-w-[65ch] mx-auto px-6 py-3 flex items-center">
                    <button onClick={handleBack} className="btn-quiet">
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </header>

            <main className="max-w-[65ch] mx-auto px-6 py-12">
                <h1 className="font-display lowercase text-3xl md:text-4xl text-ink mb-3">Terms & Privacy</h1>
                <p className="readout mb-10">Last updated: {LAST_UPDATED}</p>

                <div className="text-ink2 leading-relaxed space-y-3 text-sm mb-10">
                    <p>The short version:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong className="text-ink">Your videos and clips are yours.</strong> We never use your content to train AI models.</li>
                        <li><strong className="text-ink">You must have the rights</strong> to every video you upload or link, and you are the publisher of what you post.</li>
                        <li><strong className="text-ink">No advertising trackers.</strong> Clarity is 100% free and open source.</li>
                    </ul>
                    <p>
                        The full documents:
                    </p>
                </div>

                <div className="space-y-3 mb-12">
                    {DOCS.map((doc) => {
                        const DocIcon = doc.icon;
                        return (
                        <a
                            key={doc.href}
                            href={doc.href}
                            className="flex items-start gap-4 p-4 border border-rule rounded-card hover:border-brass transition-colors"
                        >
                            <DocIcon size={18} className="text-brass shrink-0 mt-0.5" />
                            <span>
                                <span className="block text-ink font-medium">{doc.title}</span>
                                <span className="block text-sm text-muted mt-1">{doc.desc}</span>
                                <span className="block text-xs text-muted mt-1 underline underline-offset-2">
                                    también en español: {doc.es}
                                </span>
                            </span>
                        </a>
                        );
                    })}
                </div>

                <p className="text-sm text-muted">
                    Clarity is free and open-source software licensed under the MIT License.
                </p>
            </main>
        </div>
    );
}
