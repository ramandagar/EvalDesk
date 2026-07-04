from typing import TypedDict, Optional


class Project(TypedDict):
    id: str
    name: str
    agentEndpoint: Optional[str]
    hasAgentApiKey: bool


class Run(TypedDict):
    id: str
    projectId: str
    status: str           # queued | running | completed | failed | signed
    totalCases: int
    passCount: int
    failCount: int
    partialCount: int
    unratedCount: int
    passRate: Optional[int]


class TestCase(TypedDict):
    id: str
    projectId: str
    title: str
    input: str
    expectedOutput: Optional[str]
    context: Optional[str]
    category: Optional[str]
