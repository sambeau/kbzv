# KBZV: Kanbanzai Viewer-Initial Proposal

## Overview

This is a proposal to create a Kanbanzai Viewer (KBZV): an application to provide human users with an intuitive and efficient way to visualise their Kanbanzai workflow—in particular, their Markdown documents.

## Kanbanzai System

The Kanbanzai system is an opinionated _‘design-led'_ way to manage an _‘agentic’_ development process—by which I mean, it’s a way to make it easier for humans and AIs to make software together. 

Kanbanzai can be used with small projects, but it has been designed to manage large software projects—ones with many features, phases and … _documents._

Kanbanzai is similar to _’spec-driven’ development_, however in spec-driven development the development collaboration begins with the specification and the system manages the development process afterwards. 

The Kanbanzai system is also *spec-driven*. However, it manages the process of getting to a specification, too. 

Kanbanzai is similar to an _’agile’ development_ practice, especially _Kanban_ (which Google tells me is, “an Agile framework that visualises work, limits work-in-progress, and promotes continuous improvement through transparent workflows”).—Kanbanzai manages the workflow by tracking the state of each feature as it travels from proposal to specification, and from specification to done (and many other states in-between).

Kanbanzai is different to Kanban in that it is a document-led process—not a ticket-led process—at least for the part the humans manage. Work starts with designs held within design documents and, at each stage of pre-development, new documents are spawned: _design plan_ → _design_ → _specification_ → _development plan_ → _review_.

Kanbanzai is different to Kanban in that not only does it track the work stages, it tracks the document stages, e.g. _draft_ → _draft 2_ → _draft 3_ → _final_.

## `kanbanzai` MCP server

`kanbanzai` is an MCP server that acts as a _project manager_ for a large software project. Or, more correctly, it is a tool for AI agents to help them manage a large software project.

`kanbanzai` is similar to a program like Jira. It is a server that holds the state of all tasks needing done (and all the history of tasks that *have* been done).

`kanbanzai` is different to Jira in several ways. 

`kanbanzai` is an MCP server, not a web server. It is software that provides tools to an AI, not a server for humans to manage their project (that provides AI helpers). The humans don’t manage the work, AI Agents do.

`kanbanzai` interfaces with humans through documents rather than tickets. Once development begins, `kanbanzai` breaks a feature into tasks, and implements them. But the AI Agent manages this process without human intervention.

`kanbanzai` is also an _‘AI orchestration platform’_, which Google tells me is, “a software solution that coordinates, manages, and integrates multiple artificial intelligence (AI) models, agents, data sources, and workflows into a cohesive, automated system”. So, yes—that—which is to say, `kanbanzai` manages the process of breaking plans into features, designs into specifications and specifications into individual development tasks. It works out what can be done in parallel and manages the process of handing work to _‘AI subagents’_ to complete the work. It also reviews their work, manages anything that needs to be done again, and even collects feedback about how the process went. Yes—`kanbanzai` does _retrospectives_.

`kanbanzai` is also a _‘Knowledge Graph Memory Server’_ which Google tells me is, “an MCP (Model Context Protocol) server that provides AI agents (like Claude or Cursor) with persistent, structured long-term memory”. Each AI Agents is created without any knowledge of the projects it is working on. A memory server stores all the necessary knowledge about the project in a structured queryable way. AI agents store facts in the system, ready to be looked up by the next agent—including designs and specifications, that get broken down into key concepts and tagged with metadata.

`kanbanzai` isn’t a tool for project managers; it’s a tool that turns AI Agents *into* project managers.

## `kanbanzai`-human interface

`kanbanzai` is software that interfaces with AI Agents, not humans. It’s pretty-much invisible to the humans working in the project. The humans interface with the system by writing documents and talking to an AI.

In this system, the humans act as product managers and designers; the AIs act as project managers and developers.

So, how does a human keep track of the project? They have two choices: look at their documents to see if there’s a spec or a dev-plan, or, more likely, ask a project manager how the project is going—in this case an AI Agent. Which isn’t that different to how it would work with an all-human team.

All important documents in the Kanbanzai system are in Markdown format (it what AIs use). That doesn’t mean there can’t be other assets, like art files or audio assets, but, at present, `kanbanzai` won’t read Word or Excel documents.

## `kanbanzai`-state-store

`kanbanzai` doesn’t use a database. It stores its state in files within the project in a `.kbz/` folder. State is just YAML files. This means that there’s no central database, and state is synced between multiple users by `git`.

While the Kanbanzai system is designed for managing large projects, it is (currently) optimised for small teams—possibly single-human teams. Without a database, creating a new project is a lightweight process and state is invisibly maintained every time you push to remote. `kanbanzai` maintains the ordering of elements within the YAML files, so when conflicts occur, they should merge cleanly.

This doesn’t preclude the use of a database, should the need arise. However, files seem to work just fine at present. If YAML  and Git aren’t appropriate for, say, large teams, then we will revisit and add realtime database sync. 

## `kanbanzai`-server technology

`kanbanzai` is an MCP server written in Go. It manages a store of state in the `.kbz/` that, in turn, holds the state of the project along with state, metadata, and links out to document files elsewhere in the project files (usually the to `work/` folder).

When a document changes, or an _‘entity’_ in the workflow changes state (say, a task moves from _implementing_ to _done_),  the server updates the corresponding YAML files.

When a document is added to the system, the AI project manager annotates it by adding metadata to it’s record in the state store. Not just about its workflow state, but metadata about the contents of the file: facts, concepts etc.

The server has no interface for humans. But, being that a `.kbz` store is just YAML files, creating tools that work with it—like a viewer—is reasonably straightforward.

Kanbanzai provides a library and a  **schema reference**, see for details:

- work/plan/kbz-references/kanbanzai-guide-for-viewer-agents.md
- work/plan/kbz-references/schema-reference.md

## `kbzv`-a viewer tool for Kanbanzi

Which brings us to `kbzv`: the **K**an**b**an**z**ai **V**iewer.

The intention is to build a Markdown viewer for Kanabanzai that can also show the state of the work within a project. Something familiar to, say, a Jira user without providing any of the editing tools: `kbzv` is a viewer, interaction with `kanbanzai` (editing, changing state etc.) will still be managed through chat by an AI Project manager.

### UI overiew

I see v1.0 of the viewer being a glorified wiki app: Mardown files displayed, neatly, with nicely-formatted metadata and links to dynamic collections of other entities generated from whatever is clicked on: metadata makes a list of things with that metadata, references to files in the system are navigable, etc.

### Techonolgy questions

We have various options that I would like to discuss:
- A Go server that provides static HTML (one binary solution)
- A Go server that provides a CRUD API + a javascript app, e.g. React or similar (can use Go library)
- A Javascript/Typescipt app e.g. Next.js (will need to use schema and roll out own `kbz` store library)
- An app

I am interested in an app for a number of reasons, the main one being encapsulation. I hate having to ship a server as a large pile of folders that require NPM or somesuch. There's something wonderful about a single binary installation.

There are a variety of options here:
- Electron (huge binaries, but accesss to Javascript libraries)
- Tauri (small binaries, but Rust-based not Go, but accesss to Javascript libraries)
- Native macOS app? (no libraries, but wealth of native UI)
- What other options are there?
- What do we need?
- So what should we choose?

IN terms of using kbz as a database
- what are the perils?
- Can we view a store that is in use?
- Would we *have* to always clone a whole repository just to view it?
- What would be the implications of adding write capabailites at some point?
- Would chosing the Go library make a difference to these questions in any way?
