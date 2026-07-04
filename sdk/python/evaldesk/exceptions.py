class EvalDeskError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)
