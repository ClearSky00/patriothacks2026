# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatriotHacks 2026 hackathon project. A voice-cloning language learning app designed to help non-English speakers learn English by hearing lessons spoken in their own voice.

### How It Works

1. **Voice Cloning**: Users record a short voice sample. The app sends this sample to the ElevenLabs API to create a personalized voice clone.
2. **Lesson Generation**: English lessons (words, phrases, sentences) are generated and converted to speech using the user's cloned voice via ElevenLabs text-to-speech.
3. **Practice & Playback**: Users listen to English content spoken in their own voice, making pronunciation and comprehension more intuitive and personalized.

### Tech Stack

- **Next.js**: Full-stack React framework handling both the frontend UI and backend API routes
- **Supabase**: Authentication, PostgreSQL database for storing user profiles/progress, and file storage for voice samples and generated audio
- **ElevenLabs API**: Voice cloning and text-to-speech synthesis
- **shadcn/ui**: Pre-built, accessible UI components

## Setup

```bash
npm install
```

## Dependencies

- **shadcn** (devDependency): UI component library CLI for adding pre-built components

## MCP Servers

The project has MCP servers configured in `.mcp.json`:
- **shadcn**: Component library tooling
- **context7**: Documentation lookup
- **github**: GitHub integration
- **magic (21st.dev)**: UI component builder
- **playwright**: Browser automation and testing
