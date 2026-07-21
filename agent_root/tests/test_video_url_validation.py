import unittest


class VideoUrlValidationTests(unittest.TestCase):
    def test_public_video_url_rejects_loopback_and_non_http_schemes(self) -> None:
        from src.api.video_analysis_routes import validate_public_video_url

        for url in ("http://127.0.0.1/video.mp4", "http://[::1]/video.mp4", "file:///tmp/video.mp4"):
            with self.assertRaises(ValueError):
                validate_public_video_url(url)

    def test_bilibili_short_links_are_routed_to_the_authorized_platform_resolver(self) -> None:
        from src.api.video_analysis_routes import is_supported_platform_video_url

        self.assertTrue(is_supported_platform_video_url("https://b23.tv/W633wW0"))
        self.assertTrue(is_supported_platform_video_url("https://www.bilibili.com/video/BV1xx411c7mD"))
        self.assertFalse(is_supported_platform_video_url("https://example.com/watch"))


if __name__ == "__main__":
    unittest.main()
