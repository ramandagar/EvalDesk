"""Data models for the EvalDesk SDK."""

from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class Project:
    """Represents an EvalDesk project."""
    id: str
    name: str
    description: Optional[str] = None
    agent_endpoint: Optional[str] = None
    agent_method: str = "POST"
    default_model: str = "gpt-4o-mini"
    cost_per_1k_input: Optional[float] = None
    cost_per_1k_output: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Project":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description"),
            agent_endpoint=data.get("agent_endpoint"),
            agent_method=data.get("agent_method", "POST"),
            default_model=data.get("default_model", "gpt-4o-mini"),
            cost_per_1k_input=data.get("cost_per_1k_input"),
            cost_per_1k_output=data.get("cost_per_1k_output"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


@dataclass
class TestCase:
    """Represents a test case within a project."""
    id: str
    project_id: str
    title: str
    input: str
    expected_output: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    difficulty: str = "medium"
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "TestCase":
        tags = data.get("tags")
        if isinstance(tags, str):
            import json
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = None
        return cls(
            id=data.get("id", ""),
            project_id=data.get("project_id", ""),
            title=data.get("title", ""),
            input=data.get("input", ""),
            expected_output=data.get("expected_output"),
            category=data.get("category"),
            tags=tags,
            difficulty=data.get("difficulty", "medium"),
            created_at=data.get("created_at"),
        )


@dataclass
class Run:
    """Represents an evaluation run."""
    id: str
    project_id: str
    name: Optional[str] = None
    status: str = "running"
    total_cases: int = 0
    pass_count: int = 0
    fail_count: int = 0
    pass_rate: Optional[int] = None
    model_used: Optional[str] = None
    total_input_tokens: Optional[int] = None
    total_output_tokens: Optional[int] = None
    total_cost: Optional[float] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Run":
        return cls(
            id=data.get("id", ""),
            project_id=data.get("project_id", "") or data.get("projectId", ""),
            name=data.get("name"),
            status=data.get("status", "running"),
            total_cases=data.get("total_cases", 0) or data.get("totalCases", 0),
            pass_count=data.get("pass_count", 0) or data.get("passCount", 0),
            fail_count=data.get("fail_count", 0) or data.get("failCount", 0),
            pass_rate=data.get("pass_rate") or data.get("passRate"),
            model_used=data.get("model_used") or data.get("modelUsed"),
            total_input_tokens=data.get("total_input_tokens") or data.get("totalInputTokens"),
            total_output_tokens=data.get("total_output_tokens") or data.get("totalOutputTokens"),
            total_cost=data.get("total_cost") or data.get("totalCost"),
            created_at=data.get("created_at") or data.get("createdAt"),
            completed_at=data.get("completed_at") or data.get("completedAt"),
        )


@dataclass
class RunResult:
    """Represents a single test case result within a run."""
    id: str
    run_id: str
    test_case_id: str
    agent_response: Optional[str] = None
    response_time: Optional[int] = None
    status: str = "pending"
    human_rating: Optional[str] = None
    judge_rating: Optional[str] = None
    judge_score: Optional[int] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    cost: Optional[float] = None

    @classmethod
    def from_dict(cls, data: dict) -> "RunResult":
        return cls(
            id=data.get("id", ""),
            run_id=data.get("run_id", "") or data.get("runId", ""),
            test_case_id=data.get("test_case_id", "") or data.get("testCaseId", ""),
            agent_response=data.get("agent_response") or data.get("agentResponse"),
            response_time=data.get("response_time") or data.get("responseTime"),
            status=data.get("status", "pending"),
            human_rating=data.get("human_rating") or data.get("humanRating"),
            judge_rating=data.get("judge_rating") or data.get("judgeRating"),
            judge_score=data.get("judge_score") or data.get("judgeScore"),
            tokens_input=data.get("tokens_input") or data.get("tokensInput"),
            tokens_output=data.get("tokens_output") or data.get("tokensOutput"),
            cost=data.get("cost"),
        )


@dataclass
class EvaluationResult:
    """Represents the full result of an evaluation run."""
    run: Run
    results: List[RunResult] = field(default_factory=list)
    pass_rate: Optional[int] = None
    total_cost: Optional[float] = None

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.human_rating == "pass" or r.judge_rating == "pass")

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.human_rating == "fail" or r.judge_rating == "fail")
