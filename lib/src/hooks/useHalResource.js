import { useState, useEffect } from "react";
import { HalApiCaller } from "@dxc-technology/halstack-client";

const useHalResource = ({ url, headers, asyncHeadersHandler }) => {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [resource, setResource] = useState(null);
  const [interactions, setInteractions] = useState(null);

  const buildErrorResponse = (error) => {
    const errorResponse = {
      status: error.response?.status ?? 400,
      message: error.message,
      toString: () => error.message,
    };
    if (error.response?.data) {
      errorResponse.body = error.response.data;
    }
    return errorResponse;
  };

  useEffect(() => {
    const fetchResource = async () => {
      setStatus("fetching");
      try {
        const asyncHeaders = asyncHeadersHandler ? await asyncHeadersHandler() : {};
        const response = await HalApiCaller.get({
          url,
          headers: { ...headers, ...asyncHeaders },
        });
        if (response.containsHalResource) {
          setResource(response.halResource);
          setInteractions(getInteractions(response.halResource));
          setStatus("resolved");
        } else {
          setResource(null);
          const errorResponse = buildErrorResponse({
            message: "Response does not contain a valid HAL resource",
          });
          setError(errorResponse);
          setStatus("rejected");
        }
      } catch (err) {
        setResource(null);
        setError(buildErrorResponse(err));
        setStatus("rejected");
      }
    };

    const getInteractions = (halResource) => {
      return halResource
        .getInteractions()
        .map((interaction) => ({
          rel: interaction.rel,
          handler: getInteractionHandler(
            interaction.method,
            halResource.getLink("self"),
            interaction.href
          ),
        }))
        .reduce(
          (obj, interaction) => ({
            ...obj,
            [interaction.rel]: interaction.handler,
          }),
          {}
        );
    };

    const getInteractionHandler = (method, resourceSelf, methodHref) => {
      const apiCallerFunctionName =
        method === "GET"
          ? "get"
          : method === "POST"
          ? "post"
          : method === "DELETE"
          ? "del"
          : method === "PATCH"
          ? "patch"
          : null;
      return async (body) => {
        setStatus("interaction");
        const asyncHeaders = asyncHeadersHandler ? await asyncHeadersHandler() : {};
        return HalApiCaller[apiCallerFunctionName]({
          url: methodHref,
          body,
          headers: { ...headers, ...asyncHeaders },
        })
          .then((response) => {
            if (
              response.containsHalResource &&
              response.halResource?.getLink("self")?.href === resourceSelf?.href
            ) {
              setResource(response.halResource);
              setStatus("resolved");
            } else {
              setStatus("resolved");
            }
            return response;
          })
          .catch((err) => {
            setStatus("resolved");
            const errorResponse = { ...buildErrorResponse(err) };
            throw errorResponse;
          });
      };
    };
    if (url) {
      fetchResource();
    }
  }, [url, headers, asyncHeadersHandler]);

  return [resource, status, error, interactions];
};

export default useHalResource;
