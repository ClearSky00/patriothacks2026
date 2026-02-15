/* ═══════════════════════════════════════════════════════════════════════════
   Kahaani — Client-side Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── PDF.js Setup ─────────────────────────────────────────────────────────
const pdfjsLib = globalThis.pdfjsLib;
if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
}

// ─── State ────────────────────────────────────────────────────────────────
const state = {
    voiceId: null,
    voiceName: null,
    pages: [],        // { pageNum, originalText, translatedText }
    currentPage: 0,
    sourceLang: 'Hindi',
    currentAudio: null,
    quizData: null,
    pdfDoc: null,      // pdf.js document for rendering pages
    pdfFile: null,     // raw File object for upload
    isAnimating: false, // Animation lock
};

// ─── DOM refs ─────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Screens
const screens = {
    setup: $('#screen-setup'),
    'story-input': $('#screen-story-input'),
    reader: $('#screen-reader'),
    quiz: $('#screen-quiz'),
};

// ─── Particles ────────────────────────────────────────────────────────────
function initParticles() {
    const container = $('#particles');
    const colors = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#a29bfe'];
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 6 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.background = color;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 15 + 10}s`;
        p.style.animationDelay = `${Math.random() * 15}s`;
        container.appendChild(p);
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────
function goToScreen(name) {
    Object.values(screens).forEach((s) => {
        if (s) {
            s.classList.remove('active');
            s.classList.add('hidden');
        }
    });
    $$('.nav-dot').forEach((d) => d.classList.remove('active'));

    if (screens[name]) {
        screens[name].classList.remove('hidden');
        screens[name].classList.add('active');
        const dot = $(`.nav-dot[data-screen="${name}"]`);
        if (dot) dot.classList.add('active');
    }
}

$$('.nav-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
        const screen = dot.dataset.screen;
        // Only allow if requirements met
        if (screen === 'reader' && state.pages.length === 0) return;
        if (screen === 'quiz' && state.pages.length === 0) return;
        goToScreen(screen);
    });
});

function markStepComplete(screen) {
    const dot = $(`.nav-dot[data-screen="${screen}"]`);
    if (dot) dot.classList.add('completed');
}

// ─── Setup Screen ─────────────────────────────────────────────────────────
const uploadZone = $('#uploadZone');
const audioFileInput = $('#audioFile');
const fileInfo = $('#fileInfo');
const fileName = $('#fileName');
const removeFile = $('#removeFile');
const cloneBtn = $('#cloneBtn');
const cloneLoader = $('#cloneLoader');
const cloneStatus = $('#cloneStatus');
const parentName = $('#parentName');
const pickVoiceBtn = $('#pickVoiceBtn');
const voicePicker = $('#voicePicker');
const voiceList = $('#voiceList');

// Upload zone click/drag
uploadZone.addEventListener('click', () => audioFileInput.click());
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        audioFileInput.files = e.dataTransfer.files;
        handleFileSelect();
    }
});

audioFileInput.addEventListener('change', handleFileSelect);

function handleFileSelect() {
    const file = audioFileInput.files[0];
    if (!file) return;
    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    uploadZone.classList.add('hidden');
    cloneBtn.disabled = false;
}

removeFile.addEventListener('click', () => {
    audioFileInput.value = '';
    fileInfo.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    cloneBtn.disabled = true;
});

// Clone voice
cloneBtn.addEventListener('click', async () => {
    const file = audioFileInput.files[0];
    if (!file) return;

    cloneBtn.disabled = true;
    cloneLoader.classList.remove('hidden');
    cloneBtn.querySelector('.btn-text')?.classList.add('hidden');

    try {
        const form = new FormData();
        form.append('audio', file);
        form.append('name', parentName.value || 'Parent Voice');

        const res = await fetch('/api/clone-voice', { method: 'POST', body: form });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Clone failed');

        state.voiceId = data.voiceId;
        state.voiceName = data.name;
        cloneStatus.classList.remove('hidden');
        cloneStatus.querySelector('.status-text').textContent =
            `Voice "${data.name}" cloned successfully! 🎉`;

        // Mark step complete, go to next
        markStepComplete('setup');
        setTimeout(() => goToScreen('story-input'), 1200);
    } catch (err) {
        alert('Voice cloning failed: ' + err.message);
    } finally {
        cloneBtn.disabled = false;
        cloneLoader.classList.add('hidden');
        cloneBtn.querySelector('.btn-text')?.classList.remove('hidden');
    }
});

// Pick existing voice
pickVoiceBtn.addEventListener('click', async () => {
    voicePicker.classList.toggle('hidden');
    if (!voicePicker.classList.contains('hidden') && voiceList.children.length === 0) {
        voiceList.innerHTML = '<p style="padding:12px;color:var(--clr-text-dim)">Loading voices...</p>';
        try {
            const res = await fetch('/api/voices');
            const voices = await res.json();
            voiceList.innerHTML = '';
            voices.forEach((v) => {
                const el = document.createElement('button');
                el.className = 'voice-item';
                el.innerHTML = `
          <span class="voice-item-name">${v.name}</span>
          <span class="voice-item-cat">${v.category || 'custom'}</span>
        `;
                el.addEventListener('click', () => {
                    $$('.voice-item').forEach((i) => i.classList.remove('selected'));
                    el.classList.add('selected');
                    state.voiceId = v.voice_id;
                    state.voiceName = v.name;
                    cloneStatus.classList.remove('hidden');
                    cloneStatus.querySelector('.status-text').textContent =
                        `Using voice "${v.name}" ✅`;
                    markStepComplete('setup');
                    setTimeout(() => goToScreen('story-input'), 800);
                });
                voiceList.appendChild(el);
            });
        } catch (err) {
            voiceList.innerHTML = '<p style="padding:12px;color:var(--clr-error)">Failed to load voices</p>';
        }
    }
});

// ─── Story Input Screen (PDF Upload) ──────────────────────────────────────
const pdfUploadZone = $('#pdfUploadZone');
const pdfFileInput = $('#pdfFile');
const pdfFileInfo = $('#pdfFileInfo');
const pdfFileName = $('#pdfFileName');
const removePdf = $('#removePdf');
const processPdfBtn = $('#processPdfBtn');
const pdfLoader = $('#pdfLoader');
const pdfProgress = $('#pdfProgress');
const sourceLang = $('#sourceLang');

// PDF upload zone click/drag
pdfUploadZone.addEventListener('click', () => pdfFileInput.click());
pdfUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfUploadZone.classList.add('drag-over');
});
pdfUploadZone.addEventListener('dragleave', () => pdfUploadZone.classList.remove('drag-over'));
pdfUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfUploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        pdfFileInput.files = e.dataTransfer.files;
        handlePdfSelect();
    }
});

pdfFileInput.addEventListener('change', handlePdfSelect);

function handlePdfSelect() {
    const file = pdfFileInput.files[0];
    if (!file) return;
    pdfFileName.textContent = file.name;
    pdfFileInfo.classList.remove('hidden');
    pdfUploadZone.classList.add('hidden');
    processPdfBtn.disabled = false;
    state.pdfFile = file;

    // Pre-load PDF.js doc for page rendering
    if (pdfjsLib) {
        const fileUrl = URL.createObjectURL(file);
        pdfjsLib.getDocument(fileUrl).promise.then((doc) => {
            state.pdfDoc = doc;
            console.log('PDF loaded:', doc.numPages, 'pages');
        });
    }
}

removePdf.addEventListener('click', () => {
    pdfFileInput.value = '';
    pdfFileInfo.classList.add('hidden');
    pdfUploadZone.classList.remove('hidden');
    processPdfBtn.disabled = true;
    state.pdfFile = null;
    state.pdfDoc = null;
});

// Process PDF
processPdfBtn.addEventListener('click', async () => {
    if (!state.pdfFile) return;
    if (!state.voiceId) return alert('Please set up a voice first!');

    state.sourceLang = sourceLang.value;

    processPdfBtn.disabled = true;
    pdfLoader.classList.remove('hidden');
    processPdfBtn.querySelector('.btn-text').classList.add('hidden');
    pdfProgress.classList.remove('hidden');

    try {
        const form = new FormData();
        form.append('pdf', state.pdfFile);
        form.append('sourceLang', state.sourceLang);

        const res = await fetch('/api/process-pdf', { method: 'POST', body: form });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'PDF processing failed');

        state.pages = data.pages;
        state.currentPage = 0;

        // Convert old lines format for quiz compatibility
        state.lines = state.pages.map(p => ({
            original: p.originalText,
            translated: p.translatedText,
        }));

        pdfProgress.querySelector('.status-icon').textContent = '✅';
        pdfProgress.querySelector('.status-text').textContent =
            `Found ${data.pages.length} story pages (of ${data.totalPdfPages} total)`;

        markStepComplete('story-input');
        setTimeout(() => {
            goToScreen('reader');
            renderCurrentPage();
        }, 1000);
    } catch (err) {
        alert('PDF processing failed: ' + err.message);
        pdfProgress.classList.add('hidden');
    } finally {
        processPdfBtn.disabled = false;
        pdfLoader.classList.add('hidden');
        processPdfBtn.querySelector('.btn-text').classList.remove('hidden');
    }
});

// ─── Story Reader Screen (Page-by-Page) ───────────────────────────────────
const pageCanvas = $('#pageCanvas');
const pageCounter = $('#pageCounter');
const pageTranslated = $('#pageTranslated');
const pageOriginal = $('#pageOriginal');
const originalContainer = $('#originalContainer');
const prevPageBtn = $('#prevPageBtn');
const nextPageBtn = $('#nextPageBtn');
const playEnglishBtn = $('#playEnglishBtn');
const playOriginalBtn = $('#playOriginalBtn');
const toggleOriginalBtn = $('#toggleOriginalBtn');

const goToQuizBtn = $('#goToQuizBtn');
const quizBtnContainer = $('#quizBtnContainer');
const textContainer = $('#textContainer'); // Cached reference

// ─── Vocab Panel Logic ────────────────────────────────────────────────────
// ─── Vocab Bar Logic ──────────────────────────────────────────────────────
const vocabDisplayBar = $('#vocabDisplayBar');
const vocabWord = $('#vocabWord');
const vocabTranslation = $('#vocabTranslation');
let vocabTimeout;

async function handleVocabClick(english, original) {
    if (vocabTimeout) clearTimeout(vocabTimeout);

    vocabWord.textContent = english;
    vocabTranslation.textContent = original;

    vocabDisplayBar.classList.add('visible');

    // Smart Audio: Only play if main audio is NOT playing
    if (!state.currentAudio || state.currentAudio.paused) {
        playVocabAudio(english, original);
    }

    // Hide after 5 seconds
    vocabTimeout = setTimeout(() => {
        vocabDisplayBar.classList.remove('visible');
    }, 5000);
}

async function playVocabAudio(english, original) {
    if (state.currentAudio && !state.currentAudio.paused) return; // Don't interrupt main story

    try {
        const textToSpeak = `${english}... ${original}`;
        const res = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textToSpeak,
                voiceId: state.voiceId
            }),
        });

        if (!res.ok) throw new Error('TTS failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    } catch (err) {
        console.error('Vocab audio error:', err);
    }
}

// ─── Navigation & Interaction ─────────────────────────────────────────────

prevPageBtn.addEventListener('click', () => {
    if (state.currentPage > 0) {
        state.currentPage--;
        renderCurrentPage();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (state.currentPage < state.pages.length - 1) {
        state.currentPage++;
        renderCurrentPage();
    }
});

playEnglishBtn.addEventListener('click', () => playPageAudio('english'));
playOriginalBtn.addEventListener('click', () => playPageAudio('original'));


function resetAudioState() {
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio = null;
    }
    // Reset buttons content
    playEnglishBtn.innerHTML = '<span>Listen in English</span>';
    playOriginalBtn.innerHTML = '<span>Listen in Original</span>';
    playEnglishBtn.disabled = false;
    playOriginalBtn.disabled = false;
}

async function renderCurrentPage() {
    resetAudioState();
    vocabDisplayBar.classList.remove('visible');

    const page = state.pages[state.currentPage];
    if (!page) return;

    const isLastPage = state.currentPage === state.pages.length - 1;

    pageCounter.textContent = `Page ${state.currentPage + 1} of ${state.pages.length}`;

    // Text Content with Vocab Highlighting
    if (page.vocab && page.vocab.length > 0) {
        const text = page.translatedText || '';
        let ranges = [];

        // Sort vocab by length descending
        const sortedVocab = [...page.vocab].sort((a, b) => b.english.length - a.english.length);

        sortedVocab.forEach((v) => {
            const escaped = v.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                const isOverlapping = ranges.some(r => (start < r.end && end > r.start));
                if (!isOverlapping) {
                    ranges.push({ start, end, word: match[0], vocab: v });
                }
            }
        });

        ranges.sort((a, b) => a.start - b.start);

        let html = '';
        let lastIndex = 0;

        ranges.forEach((r) => {
            html += text.substring(lastIndex, r.start);
            const safeEnglish = r.vocab.english.replace(/"/g, '&quot;');
            const safeOriginal = r.vocab.original.replace(/"/g, '&quot;');
            html += `<span class="interactive-word" data-english="${safeEnglish}" data-original="${safeOriginal}">${r.word}</span>`;
            lastIndex = r.end;
        });
        html += text.substring(lastIndex);
        pageTranslated.innerHTML = html;

        // Add listeners
        pageTranslated.querySelectorAll('.interactive-word').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                handleVocabClick(el.dataset.english, el.dataset.original);
            });
        });
    } else {
        pageTranslated.textContent = page.translatedText;
    }

    pageOriginal.textContent = page.originalText;

    // Show quiz button only on last page
    const goToQuizBtn = $('#goToQuizBtn'); // Re-select if needed
    if (isLastPage) {
        goToQuizBtn?.classList.remove('hidden');
    } else {
        goToQuizBtn?.classList.add('hidden');
    }

    // Update navigation buttons
    prevPageBtn.disabled = state.currentPage === 0;
    nextPageBtn.disabled = state.currentPage === state.pages.length - 1;

    // Render PDF page image
    if (state.pdfDoc) {
        try {
            const pdfPage = await state.pdfDoc.getPage(page.pageNum);
            const scale = 1.5;
            const viewport = pdfPage.getViewport({ scale });

            pageCanvas.width = viewport.width;
            pageCanvas.height = viewport.height;

            const ctx = pageCanvas.getContext('2d');
            await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        } catch (err) {
            console.error('Render page error:', err);
        }
    }
}

async function playPageAudio(lang) {
    const pageIndex = state.currentPage;
    const page = state.pages[pageIndex];
    if (!page || !state.voiceId) return;

    const text = lang === 'english' ? page.translatedText : page.originalText;
    if (!text) return;

    const btn = lang === 'english' ? playEnglishBtn : playOriginalBtn;
    const label = lang === 'english' ? 'Listen in English' : 'Listen in Original';

    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio = null;
    }

    btn.innerHTML = '<span>Loading...</span>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId: state.voiceId }),
        });

        if (!res.ok) throw new Error('TTS failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (state.currentPage !== pageIndex) {
            URL.revokeObjectURL(url);
            return;
        }

        const audio = new Audio(url);
        state.currentAudio = audio;

        btn.innerHTML = '<span>Playing...</span>';
        btn.disabled = false;

        audio.play();
        audio.onended = () => {
            if (state.currentPage === pageIndex) {
                btn.innerHTML = `<span>${label}</span>`;
            }
            URL.revokeObjectURL(url);
            state.currentAudio = null;
        };
    } catch (err) {
        console.error('Play error:', err);
        if (state.currentPage === pageIndex) {
            btn.innerHTML = `<span>${label}</span>`;
            btn.disabled = false;
        }
    }
}

// ─── Quiz Screen ──────────────────────────────────────────────────────────
const quizLoading = $('#quizLoading');
const quizQuestions = $('#quizQuestions');
const quizResults = $('#quizResults');
const retryQuizBtn = $('#retryQuizBtn');


goToQuizBtn.addEventListener('click', () => {
    goToScreen('quiz');
    loadQuiz();
});

retryQuizBtn.addEventListener('click', () => {
    quizResults.classList.add('hidden');
    loadQuiz();
});

async function loadQuiz() {
    quizQuestions.innerHTML = '';
    quizLoading.classList.remove('hidden');
    quizResults.classList.add('hidden');

    try {
        const res = await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines: state.lines, sourceLang: state.sourceLang }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Quiz generation failed');

        state.quizData = data;
        renderQuiz(data.questions);
    } catch (err) {
        quizQuestions.innerHTML = `<p style="color:var(--clr-error);text-align:center">Failed to generate quiz: ${err.message}</p>`;
    } finally {
        quizLoading.classList.add('hidden');
    }
}

function renderQuiz(questions) {
    quizQuestions.innerHTML = '';
    let mcScore = 0;
    let mcTotal = 0;
    let mcNum = 0;
    let oeNum = 0;

    questions.forEach((q, qIdx) => {
        const card = document.createElement('div');
        card.className = 'quiz-question';

        if (q.type === 'multiple_choice') {
            mcTotal++;
            mcNum++;
            card.innerHTML = `
        <span class="question-badge badge-mc">Multiple Choice</span>
        <p class="question-text">${mcNum}. ${q.question}</p>
        <div class="options" id="options-${qIdx}">
          ${q.options.map((opt, oIdx) => `
            <button class="option" data-q="${qIdx}" data-o="${oIdx}">
              <span class="option-letter">${String.fromCharCode(65 + oIdx)}</span>
              <span>${opt}</span>
            </button>
          `).join('')}
        </div>
      `;

            quizQuestions.appendChild(card);

            card.querySelectorAll('.option').forEach((optBtn) => {
                optBtn.addEventListener('click', () => {
                    if (card.dataset.answered) return;
                    card.dataset.answered = 'true';
                    const selected = parseInt(optBtn.dataset.o);
                    const correct = q.correct;

                    // Mark all options
                    card.querySelectorAll('.option').forEach((o, i) => {
                        if (i === correct) o.classList.add('correct');
                        if (i === selected && selected !== correct) o.classList.add('incorrect');
                    });
                    optBtn.classList.add('selected');

                    if (selected === correct) mcScore++;

                    // Show explanation
                    const expl = document.createElement('div');
                    expl.className = 'explanation';
                    expl.textContent = q.explanation;
                    card.appendChild(expl);

                    // Check if all MCQs answered
                    checkAllAnswered();
                });
            });
        } else if (q.type === 'open_ended') {
            oeNum++;
            card.innerHTML = `
        <span class="question-badge badge-open">Open Ended</span>
        <p class="question-text">${oeNum}. ${q.question}</p>
        <div class="audio-answer">
          <button class="btn-record" data-q="${qIdx}" title="Tap to record your answer">
            <span class="record-icon">🎤</span>
            <span class="record-label">Tap to Answer</span>
          </button>
          <p class="transcript-text hidden" data-q="${qIdx}"></p>
        </div>
        <button class="hint-btn" data-q="${qIdx}">💡 Need a hint?</button>
        <button class="check-open-btn" data-q="${qIdx}">Check Answer</button>
      `;
            quizQuestions.appendChild(card);

            // Audio recording via Web Speech API
            const recordBtn = card.querySelector('.btn-record');
            const transcriptEl = card.querySelector('.transcript-text');
            let isRecording = false;
            let recognition = null;

            recordBtn.addEventListener('click', () => {
                if (isRecording && recognition) {
                    recognition.stop();
                    return;
                }

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    if (!card.querySelector('.open-answer-input')) {
                        const ta = document.createElement('textarea');
                        ta.className = 'open-answer-input';
                        ta.placeholder = 'Speech not supported — type your answer…';
                        ta.rows = 3;
                        card.querySelector('.audio-answer').appendChild(ta);
                    }
                    return;
                }

                recognition = new SpeechRecognition();
                recognition.lang = 'en-US';
                recognition.interimResults = true;
                recognition.continuous = false;

                recognition.onstart = () => {
                    isRecording = true;
                    recordBtn.classList.add('recording');
                    recordBtn.querySelector('.record-label').textContent = 'Listening…';
                    transcriptEl.classList.remove('hidden');
                    transcriptEl.textContent = '…';
                };

                recognition.onresult = (e) => {
                    let transcript = '';
                    for (let i = 0; i < e.results.length; i++) {
                        transcript += e.results[i][0].transcript;
                    }
                    transcriptEl.textContent = transcript;
                };

                recognition.onend = () => {
                    isRecording = false;
                    recordBtn.classList.remove('recording');
                    recordBtn.querySelector('.record-label').textContent = 'Tap to Answer Again';
                    recognition = null;
                };

                recognition.onerror = (e) => {
                    isRecording = false;
                    recordBtn.classList.remove('recording');
                    recordBtn.querySelector('.record-label').textContent = 'Tap to Answer';
                    if (e.error !== 'no-speech') {
                        transcriptEl.textContent = 'Could not hear you — try again!';
                        transcriptEl.classList.remove('hidden');
                    }
                    recognition = null;
                };

                recognition.start();
            });

            // Hint
            card.querySelector('.hint-btn').addEventListener('click', function () {
                if (this.nextElementSibling?.classList?.contains('hint-text')) return;
                const hint = document.createElement('div');
                hint.className = 'hint-text';
                hint.textContent = q.hint || 'Think about what happened in the story!';
                this.after(hint);
            });

            // Check answer
            card.querySelector('.check-open-btn').addEventListener('click', () => {
                const sa = document.createElement('div');
                sa.className = 'sample-answer';
                sa.innerHTML = `<strong>Sample Answer:</strong> ${q.sampleAnswer}`;
                if (!card.querySelector('.sample-answer')) {
                    card.appendChild(sa);
                }
            });
        } else {
            quizQuestions.appendChild(card);
        }
    });

    function checkAllAnswered() {
        const totalMC = questions.filter((q) => q.type === 'multiple_choice').length;
        const answeredMC = quizQuestions.querySelectorAll('.quiz-question[data-answered]').length;
        if (answeredMC === totalMC) {
            setTimeout(() => {
                quizResults.classList.remove('hidden');
                $('#resultsScore').textContent = `${mcScore} / ${totalMC}`;
                const pct = mcScore / totalMC;
                if (pct === 1) {
                    $('#resultsMessage').textContent = '🌟 Perfect! You understood everything!';
                } else if (pct >= 0.6) {
                    $('#resultsMessage').textContent = '👏 Great job! You understood most of the story!';
                } else {
                    $('#resultsMessage').textContent = '💪 Keep practicing! Try reading the story again.';
                }
                markStepComplete('quiz');
            }, 800);
        }
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────
// ─── Sample Story Logic ───────────────────────────────────────────────────
const loadSampleBtn = $('#loadSampleBtn');
loadSampleBtn.addEventListener('click', async () => {
    if (!state.voiceId) {
        alert('Please select or clone a voice first!');
        goToScreen('setup');
        return;
    }

    const btnText = loadSampleBtn.querySelector('span');
    const originalText = btnText.innerHTML;
    btnText.textContent = '⏳ Loading Sample...';
    loadSampleBtn.disabled = true;

    try {
        // Fetch JSON
        const data = await fetch('/samples/bangoin_01060025.json').then(r => {
            if (!r.ok) throw new Error('Sample JSON not found');
            return r.json();
        });

        // Fetch PDF
        const pdfBlob = await fetch('/samples/bangoin_01060025.pdf').then(r => {
            if (!r.ok) throw new Error('Sample PDF not found');
            return r.blob();
        });

        state.pdfFile = new File([pdfBlob], "bangoin_01060025.pdf", { type: "application/pdf" });

        // Load PDF document
        if (typeof pdfjsLib !== 'undefined') {
            const fileUrl = URL.createObjectURL(pdfBlob);
            state.pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
        }

        state.pages = data.pages;
        state.sourceLang = 'Hindi'; // Hardcoded for this sample
        state.currentPage = 0;

        // Prepare context for Quiz
        state.lines = state.pages.map(p => ({
            original: p.originalText,
            translated: p.translatedText
        }));

        markStepComplete('story-input');
        goToScreen('reader');
        renderCurrentPage();

    } catch (err) {
        console.error(err);
        alert('Failed to load sample: ' + err.message);
    } finally {
        btnText.innerHTML = originalText;
        loadSampleBtn.disabled = false;
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────
initParticles();
