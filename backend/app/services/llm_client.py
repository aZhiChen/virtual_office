import httpx
from app.core.config import settings
from app.core.logger import logger


async def chat_completion(messages: list[dict], max_tokens: int = 200) -> str:
    """Call OpenAI-compatible chat completion endpoint."""
    if not settings.LLM_API_KEY:
        logger.warning("LLM API key not configured")
        return "[LLM not configured - set LLM_API_KEY in .env]"

    async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.8,
            },
        )
        if response.status_code != 200:
            try:
                err_body = response.json()
                logger.error(f"LLM API error {response.status_code}: {err_body}")
            except Exception:
                logger.error(f"LLM API error {response.status_code}: {response.text[:500]}")
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def generate_afk_reply(
    personality: str, chat_history: list[dict], incoming_message: str
) -> str:
    """Generate an auto-reply based on the user's personality setting."""
    system_prompt = (
        "你是一个虚拟办公室中的角色。以下是你的性格设定：\n"
        f"{personality}\n\n"
        "请根据这个性格来回复同事的消息。保持简短、自然、符合角色设定。"
    )

    messages = [{"role": "system", "content": system_prompt}]
    # Append recent conversation history (limited), filter out empty content (some APIs reject it)
    for m in chat_history[-settings.LLM_MAX_CONTEXT_MESSAGES :]:
        content = (m.get("content") or "").strip()
        if content:
            messages.append({"role": m.get("role", "user"), "content": content})
    # Ensure incoming message is non-empty
    incoming = (incoming_message or "").strip() or "(无内容)"
    messages.append({"role": "user", "content": incoming})

    try:
        reply = await chat_completion(messages)
        logger.info("LLM auto-reply generated")
        return reply
    except Exception as e:
        logger.exception("LLM auto-reply failed")
        return f"[Auto-reply unavailable: {str(e)[:300]}]"


async def generate_task_summary(
    dates: list[str], tasks_by_date: dict[str, list[str]]
) -> str:
    """Summarize completed tasks across one or more dates into a brief report."""
    sections: list[str] = []
    for d in dates:
        items = tasks_by_date.get(d, [])
        lines = "\n".join(f"  - {c}" for c in items)
        sections.append(f"{d} ({len(items)} 项):\n{lines}")
    tasks_text = "\n\n".join(sections)

    system_prompt = (
        "你是一个工作总结助手。用户会提供一天或多天完成的任务列表，请根据这些任务生成一份简洁的工作总结报告。\n"
        "要求：\n"
        "1. 用中文撰写\n"
        "2. 注明涵盖的日期范围和总完成任务数量\n"
        "3. 按类别或主题归纳任务，形成条理清晰的总结\n"
        "4. 语气专业、简洁\n"
        "5. 总结控制在 300 字以内"
    )
    user_prompt = f"涵盖日期：{', '.join(dates)}\n\n完成的任务：\n{tasks_text}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        summary = await chat_completion(messages, max_tokens=600)
        logger.info(
            "Task summary generated for dates=%s, total_tasks=%d",
            dates,
            sum(len(v) for v in tasks_by_date.values()),
        )
        return summary
    except Exception as e:
        logger.exception("Task summary generation failed")
        raise RuntimeError(f"Summary generation failed: {str(e)[:300]}") from e
