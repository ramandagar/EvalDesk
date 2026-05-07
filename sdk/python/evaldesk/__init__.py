"""EvalDesk SDK for Python — AI agent evaluation toolkit."""

__version__ = "0.1.0"

from .client import EvalDeskClient
from .models import Project, TestCase, Run, RunResult, EvaluationResult

__all__ = [
    "EvalDeskClient",
    "Project",
    "TestCase",
    "Run",
    "RunResult",
    "EvaluationResult",
]
