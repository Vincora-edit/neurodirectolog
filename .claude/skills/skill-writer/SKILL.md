---
name: skill-writer
description: Create Agent Skills for Claude Code with proper structure. Use when creating new skills or agents.
---

# Skill Writer

Create well-structured Agent Skills for Claude Code.

## Quick start

Create a minimal Skill:

```bash
mkdir -p .claude/skills/my-skill
```

```yaml
---
name: my-skill
description: What it does. Use when [trigger conditions].
---

# My Skill

## Instructions
1. Step one
2. Step two
```

## Instructions

### 1. Choose type
- **Skills** (`.claude/skills/`) - Domain knowledge, instructions
- **Agents** (`.claude/agents/`) - Specialized personas with model preference
- **Commands** (`.claude/commands/`) - Executable workflows

### 2. Write frontmatter
```yaml
---
name: skill-name          # lowercase, hyphens only
description: Brief what + when to use
model: sonnet|opus|haiku  # For agents only
color: blue|green|...     # For agents only
---
```

### 3. Structure content
```markdown
# Skill Name

## Context
Project-specific information

## Instructions
Step-by-step guidance

## Output Format
Template for responses
```

### 4. Test
1. Restart Claude Code to load
2. Ask relevant questions
3. Verify automatic usage

## Validation checklist
- [ ] Directory name matches `name`
- [ ] Name is lowercase, hyphens only
- [ ] Description includes what AND when
- [ ] Instructions are actionable
