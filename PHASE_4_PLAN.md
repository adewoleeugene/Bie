# Phase 4: AI & Automation 🤖

## Overview
Transform ChristBase into an intelligent project management assistant using AI for task creation, insights, and automation.

## Features to Implement

### 1. AI Chat Assistant (ChristAI)
- **Location**: Floating widget or dedicated sidebar panel
- **Capabilities**:
  - Answer questions about project status ("How is the Website Redesign going?")
  - Summarize sprint progress
  - Find specific tasks ("Show me tasks assigned to Alice due this week")
  - Provide productivity insights

### 2. Smart Task Creation (NLP)
- **Feature**: "Quick Add" with natural language parsing
- **Input**: "Update landing page copy by Friday P1 #marketing @alice"
- **Output**: 
  - Title: Update landing page copy
  - Due Date: Next Friday
  - Priority: P1
  - Project: Marketing (if exists)
  - Assignee: Alice

### 3. Automated Workflows (Rules Engine)
- **Triggers**:
  - Task status change
  - Task created
  - Due date approaching
- **Actions**:
  - Assign to user
  - Send notification
  - Add comment
  - Move to project/sprint

### 4. AI Insights & Suggestions
- **Task Estimation**: suggest time estimates based on similar tasks
- **Bottleneck Detection**: "3 tasks are blocked by pending reviews"
- **Resource Allocation**: "Alice is overloaded this sprint"

## Technical Implementation

### Core Dependencies
- `openai` (or similar LLM provider) - We'll use a mock/simulated provider first if keys aren't available
- `framer-motion` for smooth UI interactions
- Vector database (optional/later) for semantic search - We'll use keyword search + LLM context for now

### New Database Models (Prisma)
```prisma
model AutomationRule {
  id             String   @id @default(cuid())
  name           String
  triggerType    String   // STATUS_CHANGE, TA_CREATED, etc.
  triggerConfig  Json     // { from: "TODO", to: "DONE" }
  actionType     String   // ASSIGN_USER, SEND_EMAIL, etc.
  actionConfig   Json     // { userId: "..." }
  isActive       Boolean  @default(true)
  organizationId String
  creatorId      String
  
  organization   Organization @relation(fields: [organizationId], references: [id])
  creator        User         @relation(fields: [creatorId], references: [id])
}

model AssistantMessage {
  id        String   @id @default(cuid())
  role      String   // user, assistant
  content   String
  metadata  Json?    // references to tasks/projects
  userId    String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}
```

### File Structure
```
src/
├── app/(dashboard)/
│   └── automation/             # Rules management page
├── components/
│   ├── ai/
│   │   ├── assistant-chat.tsx  # Chat widget
│   │   ├── smart-input.tsx     # NLP task creator
│   │   └── insight-card.tsx    # AI suggestion UI
│   └── automation/
│       ├── rule-builder.tsx    # Visual rule editor
│       └── rule-list.tsx       # List of active rules
├── lib/
│   ├── ai/
│   │   ├── llm-service.ts      # LLM wrapper
│   │   └── nlp-parser.ts       # Text parsing logic
│   └── automation/
│       └── rule-engine.ts      # Logic to execute rules
└── actions/
    └── ai.ts                   # Server actions for AI
```

## Implementation Steps

1. ✅ Create Plan
2. [ ] Update Prisma Schema (add AutomationRule, AssistantMessage)
3. ✅ Implement Smart Task Input (NLP Parser - simplistic regex version first)
4. ✅ Build AI Assistant Chat UI
5. ✅ Create Automation Rules Engine (Basic Logic + UI)
6. [ ] Implement "Quick Add" UI with NLP (Done via Smart Task Input)

## Completion
Phase 4 is substantially complete with Smart Input, AI Chat, and Automation Rules. Ready for Phase 5.
