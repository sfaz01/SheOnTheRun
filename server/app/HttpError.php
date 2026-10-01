<?php
declare(strict_types=1);

namespace Sotr;

/** Thrown anywhere in a request to end it with a clean JSON error. */
final class HttpError extends \RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly string $errorCode = '',
        public readonly array $extra = []
    ) {
        parent::__construct($message);
    }
}
