import httpx
from app.core.config import settings
from app.core.logger import logger


async def chat_completion(messages: list[dict]) -> str:
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
                "max_tokens": 200,
                "temperature": 0.8,
            },
        )
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
    # Append recent conversation history (limited)
    messages.extend(chat_history[-settings.LLM_MAX_CONTEXT_MESSAGES :])
    messages.append({"role": "user", "content": incoming_message})

    try:
        reply = await chat_completion(messages)
        logger.info("LLM auto-reply generated")
        return reply
    except Exception as e:
        logger.exception("LLM auto-reply failed")
        return f"[Auto-reply unavailable: {str(e)[:80]}]"
