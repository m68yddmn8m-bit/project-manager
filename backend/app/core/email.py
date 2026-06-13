import logging
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_USER:
        logger.warning("SMTP not configured, skipping email to %s: %s", to, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)


async def notify_task_assigned(to_email: str, assignee_name: str, task_title: str, project_name: str, task_link: str):
    html = f"""
    <p>Hi {assignee_name},</p>
    <p>You have been assigned a new task in <strong>{project_name}</strong>:</p>
    <p><strong>{task_title}</strong></p>
    <p><a href="{task_link}">View Task</a></p>
    """
    await send_email(to_email, f"New task assigned: {task_title}", html)


async def notify_comment_added(to_email: str, recipient_name: str, commenter_name: str, task_title: str, comment_body: str, task_link: str):
    html = f"""
    <p>Hi {recipient_name},</p>
    <p><strong>{commenter_name}</strong> commented on <strong>{task_title}</strong>:</p>
    <blockquote>{comment_body}</blockquote>
    <p><a href="{task_link}">View Task</a></p>
    """
    await send_email(to_email, f"New comment on: {task_title}", html)


async def notify_task_status_changed(to_email: str, recipient_name: str, task_title: str, new_status: str, project_name: str, task_link: str):
    html = f"""
    <p>Hi {recipient_name},</p>
    <p>The task <strong>{task_title}</strong> in <strong>{project_name}</strong> was moved to <strong>{new_status}</strong>.</p>
    <p><a href="{task_link}">View Task</a></p>
    """
    await send_email(to_email, f"Task status updated: {task_title}", html)
