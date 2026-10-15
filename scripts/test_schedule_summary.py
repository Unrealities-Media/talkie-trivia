import unittest
from schedule_summary import summarize


class ScheduleSummaryTests(unittest.TestCase):
    def test_only_counts_and_dates_leave_the_private_plan(self):
        private = {"movieId": 123, "content": {"clues": "SECRET"}, "futureField": "SECRET"}
        self.assertEqual(summarize({"2026-10-18_LEVEL_2": private, "2026-10-17_LEVEL_1": private}),
                         {"plannedSlots": 2, "dates": ["2026-10-17", "2026-10-18"]})
        self.assertEqual(summarize({}), {"plannedSlots": 0, "dates": []})

    def test_rejects_answer_text_or_invalid_dates_in_slot_keys(self):
        for key in ["SECRET", "2026-10-18_SECRET", "2026-13-18_LEVEL_1", "2026-10-18_LEVEL_6"]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                summarize({key: {}})
        with self.assertRaises(ValueError):
            summarize([])
