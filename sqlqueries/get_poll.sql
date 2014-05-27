select * FROM pollnado.polls i INNER JOIN pollnado.questions a ON a.poll_id = "1"
INNER JOIN pollnado.answers b ON b.question_id = a.id WHERE i.id = a.id